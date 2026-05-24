package com.oresoftware.livemutex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Java client for the live-mutex broker.
 *
 * <p>Speaks the broker's NDJSON-over-TCP wire protocol. A single
 * Client instance multiplexes many concurrent acquire/release/
 * acquire-many requests over one connection by correlating on a
 * per-request UUID.
 *
 * <p>Minimal by design — covers the new wire features (fencing tokens,
 * acquire-many, broker-side max validation) and the basic lock/unlock
 * flow. RW-lock support and the legacy {@code lock-received} ack are
 * intentionally not re-implemented; the broker's centralised TTL
 * sweeper handles clients that skip the ack.
 */
public final class Client implements AutoCloseable {

    public static final String PROTOCOL_VERSION = "0.2.25";

    private static final ObjectMapper M = new ObjectMapper();

    private final Socket socket;
    private final OutputStream out;
    private final BufferedReader in;
    private final Thread reader;
    private final Map<String, CompletableFuture<JsonNode>> inflight = new ConcurrentHashMap<>();
    private final long requestTimeoutMs;
    private volatile boolean closed = false;

    private Client(Socket socket, long requestTimeoutMs) throws IOException {
        this.socket = socket;
        this.out = socket.getOutputStream();
        this.in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
        this.requestTimeoutMs = requestTimeoutMs;
        this.reader = new Thread(this::readLoop, "live-mutex-client-reader");
        this.reader.setDaemon(true);
    }

    /** Connects, sends version handshake, returns a usable Client. */
    public static Client connect(String host, int port) throws IOException {
        return connect(host, port, TimeUnit.SECONDS.toMillis(60));
    }

    public static Client connect(String host, int port, long requestTimeoutMs) throws IOException {
        Socket s = new Socket();
        s.setTcpNoDelay(true);
        s.connect(new java.net.InetSocketAddress(host, port), 30_000);
        Client c = new Client(s, requestTimeoutMs);
        ObjectNode hello = M.createObjectNode();
        hello.put("type", "version");
        hello.put("value", PROTOCOL_VERSION);
        c.send(hello);
        c.reader.start();
        return c;
    }

    /** Acquire an exclusive lock (or a semaphore slot if {@code max > 1}). */
    public LockGrant acquire(String key, Long ttlMs, Integer max) throws Exception {
        String reqUuid = UUID.randomUUID().toString();
        ObjectNode payload = M.createObjectNode();
        payload.put("type", "lock");
        payload.put("uuid", reqUuid);
        payload.put("key", key);
        payload.put("pid", (int) ProcessHandle.current().pid());
        payload.put("keepLocksAfterDeath", false);
        if (ttlMs != null) payload.put("ttl", ttlMs);
        else payload.putNull("ttl");
        if (max != null) payload.put("max", max);

        JsonNode reply = awaitReply(reqUuid, payload);
        if (!reply.path("acquired").asBoolean(false)) {
            String err = reply.path("error").asText("lock not acquired");
            throw new LiveMutexException(err);
        }
        Long token = reply.has("fencingToken") && !reply.get("fencingToken").isNull()
                ? reply.get("fencingToken").asLong()
                : null;
        Long lrc = reply.has("lockRequestCount") && !reply.get("lockRequestCount").isNull()
                ? reply.get("lockRequestCount").asLong()
                : null;
        return new LockGrant(key, reqUuid, token, lrc);
    }

    public void release(String key, String lockUuid, boolean force) throws Exception {
        String reqUuid = UUID.randomUUID().toString();
        ObjectNode payload = M.createObjectNode();
        payload.put("type", "unlock");
        payload.put("uuid", reqUuid);
        payload.put("_uuid", lockUuid);
        payload.put("key", key);
        payload.put("force", force);
        JsonNode reply = awaitReply(reqUuid, payload);
        if (!reply.path("unlocked").asBoolean(false)) {
            throw new LiveMutexException(reply.path("error").asText("unlock rejected"));
        }
    }

    public AcquireManyGrant acquireMany(List<String> keys, Long ttlMs) throws Exception {
        if (keys == null || keys.isEmpty()) throw new IllegalArgumentException("keys must be non-empty");
        String reqUuid = UUID.randomUUID().toString();
        ObjectNode payload = M.createObjectNode();
        payload.put("type", "acquire-many");
        payload.put("uuid", reqUuid);
        payload.set("keys", M.valueToTree(keys));
        if (ttlMs != null) payload.put("ttl", ttlMs);
        else payload.putNull("ttl");

        JsonNode reply = awaitReply(reqUuid, payload);
        if (!reply.path("acquired").asBoolean(false)) {
            String why = reply.path("error").asText("");
            if (why.isEmpty() && reply.has("contendedKey")) {
                why = "contended on " + reply.get("contendedKey").asText();
            }
            if (why.isEmpty()) why = "acquire-many rejected";
            throw new LiveMutexException(why);
        }
        Map<String, Long> tokens = new HashMap<>();
        JsonNode tnode = reply.path("fencingTokens");
        if (tnode.isObject()) {
            tnode.fields().forEachRemaining(e -> tokens.put(e.getKey(), e.getValue().asLong()));
        }
        List<String> grantedKeys = new java.util.ArrayList<>();
        JsonNode keysNode = reply.path("keys");
        if (keysNode.isArray()) {
            keysNode.forEach(n -> grantedKeys.add(n.asText()));
        } else {
            grantedKeys.addAll(keys);
        }
        return new AcquireManyGrant(grantedKeys, reply.path("lockUuid").asText(""), tokens);
    }

    public void releaseMany(String lockUuid) throws Exception {
        String reqUuid = UUID.randomUUID().toString();
        ObjectNode payload = M.createObjectNode();
        payload.put("type", "release-many");
        payload.put("uuid", reqUuid);
        payload.put("lockUuid", lockUuid);
        JsonNode reply = awaitReply(reqUuid, payload);
        if (!reply.path("released").asBoolean(false)) {
            throw new LiveMutexException(reply.path("error").asText("release-many rejected"));
        }
    }

    @Override
    public void close() {
        if (closed) return;
        closed = true;
        try { socket.close(); } catch (IOException ignore) {}
        // Wake any pending callers.
        for (CompletableFuture<JsonNode> f : inflight.values()) {
            f.completeExceptionally(new LiveMutexException("connection closed"));
        }
        inflight.clear();
    }

    // ---- internals ----

    private synchronized void send(ObjectNode payload) throws IOException {
        byte[] bytes = (M.writeValueAsString(payload) + "\n").getBytes(StandardCharsets.UTF_8);
        out.write(bytes);
        out.flush();
    }

    private JsonNode awaitReply(String requestUuid, ObjectNode payload) throws Exception {
        CompletableFuture<JsonNode> fut = new CompletableFuture<>();
        inflight.put(requestUuid, fut);
        try {
            send(payload);
            return fut.get(requestTimeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException te) {
            inflight.remove(requestUuid);
            throw new LiveMutexException("request timed out");
        } finally {
            inflight.remove(requestUuid);
        }
    }

    private void readLoop() {
        try {
            String line;
            while (!closed && (line = in.readLine()) != null) {
                JsonNode msg;
                try {
                    msg = M.readTree(line);
                } catch (IOException ignore) {
                    continue;
                }
                if (!msg.isObject()) continue;
                JsonNode uuidNode = msg.get("uuid");
                if (uuidNode == null || !uuidNode.isTextual()) continue;
                CompletableFuture<JsonNode> fut = inflight.remove(uuidNode.asText());
                if (fut != null && !fut.isDone()) fut.complete(msg);
            }
        } catch (IOException ignore) {
            // socket closed
        } finally {
            close();
        }
    }
}
