//! Smoke test for the Rust live-mutex client.
//!
//! Connects to a broker on `127.0.0.1:6970` (override with
//! `LMX_HOST`/`LMX_PORT`) and exercises:
//!   - `acquire` / `release` returns a fencing token.
//!   - Two acquires for the same key produce strictly-monotonic tokens.
//!   - `acquire_many` returns one fencing token per key.
//!
//! Exits 0 on success, 1 on any assertion failure. Intended as a
//! cross-runtime smoke test that the wire protocol is implemented
//! correctly.

use live_mutex_client::{Client, LockOpts};

#[tokio::main]
async fn main() {
    let host = std::env::var("LMX_HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let port: u16 = std::env::var("LMX_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(6970);
    let addr = format!("{host}:{port}");

    let client = match Client::connect(&addr).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("connect to {addr}: {e}");
            std::process::exit(1);
        }
    };

    let g1 = client.acquire("rust-smoke", Some(LockOpts { ttl_ms: Some(5_000), ..Default::default() }))
        .await
        .expect("acquire #1");
    println!("acquire #1: lockUuid={} fencingToken={:?}", g1.lock_uuid, g1.fencing_token);
    assert!(g1.fencing_token.unwrap_or(0) >= 1, "missing fencing token on first grant");
    client.release("rust-smoke", &g1.lock_uuid, false).await.expect("release #1");

    let g2 = client.acquire("rust-smoke", None).await.expect("acquire #2");
    println!("acquire #2: lockUuid={} fencingToken={:?}", g2.lock_uuid, g2.fencing_token);
    assert!(g2.fencing_token.unwrap_or(0) > g1.fencing_token.unwrap_or(0),
        "fencing tokens should be strictly monotonic per key");
    client.release("rust-smoke", &g2.lock_uuid, false).await.expect("release #2");

    let many = client.acquire_many(&["rust-many-a", "rust-many-b", "rust-many-c"], Some(5_000))
        .await
        .expect("acquire_many");
    println!("acquire_many: lockUuid={} fencingTokens={:?}", many.lock_uuid, many.fencing_tokens);
    assert_eq!(many.fencing_tokens.len(), 3, "expected one token per key");
    client.release_many(&many.lock_uuid).await.expect("release_many");

    println!("✅ rust client smoke test passed");
}
