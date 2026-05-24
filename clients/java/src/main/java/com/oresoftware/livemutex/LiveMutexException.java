package com.oresoftware.livemutex;

/** Raised when the broker rejects a request or the connection drops mid-flight. */
public class LiveMutexException extends RuntimeException {
    public LiveMutexException(String message) {
        super(message);
    }

    public LiveMutexException(String message, Throwable cause) {
        super(message, cause);
    }
}
