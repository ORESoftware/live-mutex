package com.oresoftware.livemutex;

import java.util.List;
import java.util.Map;

/** Outcome of a successful {@link Client#acquireMany}. */
public final class AcquireManyGrant {
    public final List<String> keys;
    public final String lockUuid;
    public final Map<String, Long> fencingTokens;

    public AcquireManyGrant(List<String> keys, String lockUuid, Map<String, Long> fencingTokens) {
        this.keys = keys;
        this.lockUuid = lockUuid;
        this.fencingTokens = fencingTokens;
    }

    @Override
    public String toString() {
        return "AcquireManyGrant{keys=" + keys + ", lockUuid=" + lockUuid +
                ", fencingTokens=" + fencingTokens + "}";
    }
}
