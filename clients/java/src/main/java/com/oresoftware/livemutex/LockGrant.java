package com.oresoftware.livemutex;

/** Outcome of a successful {@link Client#acquire}. */
public final class LockGrant {
    public final String key;
    public final String lockUuid;
    /** Positive exact per-key fencing authority; successful grants never omit it. */
    public final long fencingToken;
    public final Long lockRequestCount;

    public LockGrant(String key, String lockUuid, long fencingToken, Long lockRequestCount) {
        this.key = key;
        this.lockUuid = lockUuid;
        this.fencingToken = fencingToken;
        this.lockRequestCount = lockRequestCount;
    }

    @Override
    public String toString() {
        return "LockGrant{key=" + key + ", lockUuid=" + lockUuid +
                ", fencingToken=" + fencingToken + "}";
    }
}
