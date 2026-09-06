package com.oresoftware.livemutex;

import java.util.List;

public final class Smoke {

    public static void main(String[] args) throws Exception {
        String host = System.getenv().getOrDefault("LMX_HOST", "127.0.0.1");
        int port = Integer.parseInt(System.getenv().getOrDefault("LMX_PORT", "6970"));

        try (Client c = Client.connect(host, port)) {
            LockGrant g1 = c.acquire("java-smoke", 5_000L, null);
            System.out.println("acquire #1: " + g1);
            require(g1.fencingToken != null && g1.fencingToken >= 1, "missing fencing token");
            c.release("java-smoke", g1.lockUuid, false);

            LockGrant g2 = c.acquire("java-smoke", null, null);
            System.out.println("acquire #2: " + g2);
            require(g2.fencingToken != null && g2.fencingToken > g1.fencingToken,
                    "fencing tokens must be strictly monotonic per key");
            c.release("java-smoke", g2.lockUuid, false);

            AcquireManyGrant many = c.acquireMany(List.of("java-many-a", "java-many-b", "java-many-c"), 5_000L);
            System.out.println("acquireMany: " + many);
            require(many.fencingTokens.size() == 3, "expected one token per key");
            c.releaseMany(many.lockUuid);

            System.out.println("\u2705 java client smoke test passed");
        }
    }

    private static void require(boolean cond, String msg) {
        if (!cond) {
            System.err.println("ASSERT FAIL: " + msg);
            System.exit(1);
        }
    }
}
