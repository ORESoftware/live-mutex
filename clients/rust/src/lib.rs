//! Rust client for the live-mutex broker.
//!
//! Speaks the same NDJSON-over-TCP wire protocol the canonical
//! Node.js broker exposes. Multiplexes many concurrent
//! lock/unlock/acquire-many requests over a single connection by
//! correlating on a per-request UUID.
//!
//! Minimal by design: covers `lock`, `unlock`, `acquire-many`,
//! `release-many` and the per-key fencing token. RW-lock support
//! and the legacy `lock-received` ack are intentionally not
//! re-implemented — the upstream broker's centralised TTL sweeper
//! handles clients that skip the ack path, so a stateless caller
//! gets the same correctness guarantee with simpler code.
//!
//! ```no_run
//! # use live_mutex_client::Client;
//! # async fn ex() -> Result<(), Box<dyn std::error::Error>> {
//! let client = Client::connect("127.0.0.1:6970").await?;
//! let grant = client.acquire("my-key", None).await?;
//! println!("token = {}", grant.fencing_token.unwrap_or(0));
//! client.release("my-key", &grant.lock_uuid, false).await?;
//! # Ok(()) }
//! ```

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;

/// Wire protocol version. Must match the broker. The broker only
/// rejects strictly-older clients, so revving this is forward-safe.
pub const PROTOCOL_VERSION: &str = "0.2.25";

#[derive(thiserror::Error, Debug)]
pub enum ClientError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("connection closed")]
    Closed,
    #[error("broker rejected request: {0}")]
    Rejected(String),
    #[error("request timed out after {0:?}")]
    Timeout(Duration),
}

#[derive(Debug, Clone)]
pub struct LockGrant {
    pub key: String,
    pub lock_uuid: String,
    pub fencing_token: Option<u64>,
    pub lock_request_count: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct AcquireManyGrant {
    pub keys: Vec<String>,
    pub lock_uuid: String,
    pub fencing_tokens: HashMap<String, u64>,
}

#[derive(Debug, Clone, Default)]
pub struct LockOpts {
    /// Lock TTL in milliseconds. `None` = broker default
    /// (`lockExpiresAfter`, defaults to 5s).
    pub ttl_ms: Option<u64>,
    /// Per-key concurrency level. `None` = mutex (broker treats as
    /// `1`). Must be `>= 1`; the broker rejects `0` and negative
    /// values explicitly (translated here to a [`ClientError::Rejected`]).
    pub max: Option<u32>,
}

/// In-flight request handle. The reader task pushes every reply
/// frame whose `uuid` matches into the channel; the caller decides
/// whether to consume one frame (single-reply ops like unlock/version)
/// or loop until a terminal frame arrives (acquire — the broker first
/// sends `acquired:false` to acknowledge that the request was queued,
/// then later sends `acquired:true` when the lock is actually granted,
/// reusing the same request `uuid`).
type Inflight = Arc<Mutex<HashMap<Uuid, mpsc::UnboundedSender<serde_json::Value>>>>;

#[derive(Clone)]
pub struct Client {
    inflight: Inflight,
    writer: Arc<Mutex<mpsc::Sender<Vec<u8>>>>,
    pid: u32,
    /// Per-request timeout. The broker may queue a request for
    /// arbitrarily long if its key is contended; we still want a
    /// safety net so a hung broker doesn't leak inflight rows.
    request_timeout: Duration,
}

impl Client {
    pub async fn connect(addr: &str) -> Result<Self, ClientError> {
        Self::connect_with_timeout(addr, Duration::from_secs(60)).await
    }

    pub async fn connect_with_timeout(addr: &str, request_timeout: Duration) -> Result<Self, ClientError> {
        let stream = TcpStream::connect(addr).await?;
        // Disabling Nagle's algorithm matches the canonical broker
        // default and dramatically reduces single-request latency.
        let _ = stream.set_nodelay(true);
        let (read_half, mut write_half) = stream.into_split();

        // Send version handshake. We attach a request `uuid` even
        // though the canonical Node broker doesn't require one — the
        // Rust port (`dd-rust-network-mutex`) speaks the same wire
        // format but uses serde tag-discrimination, which rejects a
        // `Version` frame that's missing the `uuid` field. Sending a
        // uuid is forward-compatible with both brokers and the
        // `version` reply already correlates by uuid downstream.
        let hello = serde_json::json!({
            "type": "version",
            "uuid": Uuid::new_v4().to_string(),
            "value": PROTOCOL_VERSION,
        });
        let mut buf = serde_json::to_vec(&hello)?;
        buf.push(b'\n');
        write_half.write_all(&buf).await?;

        let inflight: Inflight = Arc::new(Mutex::new(HashMap::new()));
        let inflight_reader = inflight.clone();

        // Single writer task — every send is funnelled through this
        // mpsc so the underlying `WriteHalf` is never contended.
        let (tx, mut rx) = mpsc::channel::<Vec<u8>>(256);
        tokio::spawn(async move {
            while let Some(bytes) = rx.recv().await {
                if write_half.write_all(&bytes).await.is_err() {
                    break;
                }
            }
        });

        // Reader task — parses NDJSON and routes by request `uuid`.
        // Drops without notification any frame that doesn't carry a
        // `uuid` (server-side warnings, etc.) — the broker only sends
        // those for diagnostic flows we don't model in this minimal
        // client.
        tokio::spawn(async move {
            let reader = BufReader::new(read_half);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let value: serde_json::Value = match serde_json::from_str(&line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                let uuid = match value.get("uuid").and_then(|v| v.as_str()) {
                    Some(s) => match Uuid::parse_str(s) {
                        Ok(u) => u,
                        Err(_) => continue,
                    },
                    None => continue,
                };
                // Keep the inflight entry; some replies (lock with
                // contention) generate multiple frames. The caller
                // removes its inflight row when it's done with the
                // request.
                let map = inflight_reader.lock().await;
                if let Some(tx) = map.get(&uuid) {
                    // `try_send` would be more correct on a bounded
                    // channel; on an unbounded channel `send` only
                    // fails if the receiver was dropped, which is
                    // fine — the caller went away.
                    let _ = tx.send(value);
                }
            }
        });

        Ok(Self {
            inflight,
            writer: Arc::new(Mutex::new(tx)),
            pid: std::process::id(),
            request_timeout,
        })
    }

    /// Internal: register an inflight row, write the payload, and
    /// return the receiver. The caller decides how many frames to
    /// consume before clearing the inflight entry.
    async fn send(&self, uuid: Uuid, payload: serde_json::Value) -> Result<mpsc::UnboundedReceiver<serde_json::Value>, ClientError> {
        let (tx, rx) = mpsc::unbounded_channel();
        {
            let mut map = self.inflight.lock().await;
            map.insert(uuid, tx);
        }
        let mut bytes = serde_json::to_vec(&payload)?;
        bytes.push(b'\n');
        let writer = self.writer.lock().await;
        if writer.send(bytes).await.is_err() {
            // Connection's reader/writer task died. Remove the
            // inflight row immediately so subsequent calls don't
            // accumulate dead receivers.
            let mut map = self.inflight.lock().await;
            map.remove(&uuid);
            return Err(ClientError::Closed);
        }
        drop(writer);
        Ok(rx)
    }

    async fn finalize(&self, uuid: Uuid) {
        let mut map = self.inflight.lock().await;
        map.remove(&uuid);
    }

    /// Send a frame and await exactly one reply for it. Used by ops
    /// (`unlock`, `acquire-many`, `release-many`, `version`) where the
    /// broker emits a single response frame per request.
    async fn send_and_await_one(&self, uuid: Uuid, payload: serde_json::Value) -> Result<serde_json::Value, ClientError> {
        let mut rx = self.send(uuid, payload).await?;
        let result = match tokio::time::timeout(self.request_timeout, rx.recv()).await {
            Ok(Some(v)) => Ok(v),
            Ok(None) => Err(ClientError::Closed),
            Err(_) => Err(ClientError::Timeout(self.request_timeout)),
        };
        self.finalize(uuid).await;
        result
    }

    pub async fn acquire(&self, key: &str, opts: Option<LockOpts>) -> Result<LockGrant, ClientError> {
        let opts = opts.unwrap_or_default();
        let uuid = Uuid::new_v4();
        let payload = serde_json::json!({
            "type": "lock",
            "uuid": uuid.to_string(),
            "key": key,
            "ttl": opts.ttl_ms.map(serde_json::Value::from).unwrap_or(serde_json::Value::Null),
            "max": opts.max,
            "pid": self.pid,
            "keepLocksAfterDeath": false,
        });
        let reply = self.await_acquired(uuid, payload).await?;
        Ok(LockGrant {
            key: key.to_string(),
            lock_uuid: reply
                .get("lockUuid")
                .and_then(|v| v.as_str())
                .map(str::to_string)
                // The broker's `lockUuid` for a single-key lock matches the
                // request `uuid` it was given; fall back to the request uuid
                // for older brokers that omit `lockUuid` on the granted frame.
                .unwrap_or_else(|| uuid.to_string()),
            fencing_token: reply.get("fencingToken").and_then(|v| v.as_u64()),
            lock_request_count: reply.get("lockRequestCount").and_then(|v| v.as_u64()),
        })
    }

    pub async fn release(&self, key: &str, lock_uuid: &str, force: bool) -> Result<(), ClientError> {
        let uuid = Uuid::new_v4();
        // We send the holder UUID under BOTH wire-level field names:
        //   * `_uuid`   — what the canonical Node `live-mutex` broker
        //                 reads (`broker-1.ts` references `data._uuid`),
        //   * `lockUuid` — what the Rust port `dd-rust-network-mutex`
        //                  reads (it uses serde tag-discrimination with
        //                  rename_all=camelCase, so its `lock_uuid`
        //                  field deserializes from `lockUuid`).
        // Sending both is wire-cheap and lets a single client speak
        // to either broker without runtime detection.
        let payload = serde_json::json!({
            "type": "unlock",
            "uuid": uuid.to_string(),
            "_uuid": lock_uuid,
            "lockUuid": lock_uuid,
            "key": key,
            "force": force,
        });
        let reply = self.send_and_await_one(uuid, payload).await?;
        if reply.get("unlocked").and_then(|v| v.as_bool()) != Some(true) {
            return Err(ClientError::Rejected(
                reply.get("error").and_then(|v| v.as_str()).unwrap_or("unlock rejected").to_string(),
            ));
        }
        Ok(())
    }

    pub async fn acquire_many(&self, keys: &[&str], ttl_ms: Option<u64>) -> Result<AcquireManyGrant, ClientError> {
        let uuid = Uuid::new_v4();
        let payload = serde_json::json!({
            "type": "acquire-many",
            "uuid": uuid.to_string(),
            "keys": keys,
            "ttl": ttl_ms,
        });
        let reply = self.await_acquired(uuid, payload).await?;
        let lock_uuid = reply.get("lockUuid").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let mut tokens = HashMap::new();
        if let Some(map) = reply.get("fencingTokens").and_then(|v| v.as_object()) {
            for (k, v) in map {
                if let Some(t) = v.as_u64() { tokens.insert(k.clone(), t); }
            }
        }
        let granted_keys = reply.get("keys").and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
            .unwrap_or_else(|| keys.iter().map(|s| s.to_string()).collect());
        Ok(AcquireManyGrant { keys: granted_keys, lock_uuid, fencing_tokens: tokens })
    }

    pub async fn release_many(&self, lock_uuid: &str) -> Result<(), ClientError> {
        let uuid = Uuid::new_v4();
        let payload = serde_json::json!({
            "type": "release-many",
            "uuid": uuid.to_string(),
            "lockUuid": lock_uuid,
        });
        let reply = self.send_and_await_one(uuid, payload).await?;
        if reply.get("released").and_then(|v| v.as_bool()) != Some(true) {
            return Err(ClientError::Rejected(
                reply.get("error").and_then(|v| v.as_str()).unwrap_or("release-many rejected").to_string(),
            ));
        }
        Ok(())
    }

    /// Send an acquire-shaped request and wait for a terminal reply.
    /// The broker may emit two frames for the same `uuid`:
    ///   1. `acquired:false` — your request has been queued behind the
    ///      current holder. `lockRequestCount` is your queue depth.
    ///   2. `acquired:true`  — you're the holder; `lockUuid` and
    ///      `fencingToken` (or `fencingTokens` for acquire-many) are
    ///      now set.
    /// The legacy Node client distinguishes these by listening for
    /// further frames after the first; we do the same. A frame with
    /// an explicit `error` field is treated as terminal (rejected).
    async fn await_acquired(
        &self,
        uuid: Uuid,
        payload: serde_json::Value,
    ) -> Result<serde_json::Value, ClientError> {
        let mut rx = self.send(uuid, payload).await?;
        let deadline = tokio::time::Instant::now() + self.request_timeout;
        let result = loop {
            match tokio::time::timeout_at(deadline, rx.recv()).await {
                Ok(Some(frame)) => {
                    if let Some(err) = frame.get("error").and_then(|v| v.as_str()) {
                        // Broker explicitly rejected (validation
                        // error, etc). Terminal.
                        break Err(ClientError::Rejected(err.to_string()));
                    }
                    if frame.get("acquired").and_then(|v| v.as_bool()) == Some(true) {
                        break Ok(frame);
                    }
                    // `acquired:false` without an error is a "you're
                    // queued" ack — keep listening for the eventual
                    // grant on the same uuid.
                }
                Ok(None) => break Err(ClientError::Closed),
                Err(_) => break Err(ClientError::Timeout(self.request_timeout)),
            }
        };
        self.finalize(uuid).await;
        result
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct StatsSnapshot {
    #[serde(rename = "totalLocks")] pub total_locks: u64,
    #[serde(rename = "totalHolders")] pub total_holders: u64,
    #[serde(rename = "pendingRequests")] pub pending_requests: u64,
    #[serde(rename = "ttlEvictionsTotal")] pub ttl_evictions_total: u64,
    #[serde(rename = "pendingDeadlines")] pub pending_deadlines: u64,
}
