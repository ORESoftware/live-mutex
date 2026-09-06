package com.oresoftware.livemutex;

/** Outcome of a successful {@link Client#acquire}. */
public final class LockGrant {
    public final String key;
    public final String lockUuid;
    /** Per-key monotonic fencing token. {@code null} if the broker pre-dates fencing-token support. */
    public final Long fencingToken;
    public final Long lockRequestCount;

    public LockGrant(String key, String lockUuid, Long fencingToken, Long lockRequestCount) {
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
