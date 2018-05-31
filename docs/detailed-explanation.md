
## In more detail

Live-Mutex is very useful and convenient for developers who need a multi-process locking mechanism, but may find it
inconvenient or impossible to use Redis, or similar proven mutex brokers. In other words, this library is designed to support other
libraries more so than applications.

For example, an `npm install` routine could easily benefit from using `live-mutex` over the currently library that's used (lockfile).

Live-Mutex offers lightweight (non-polling), safe (prevents you from unlocking a lock by accident),
and high-performance (faster than anything else) locking.

It offers the same locking features that Redis-related libraries would offer, but should be more *developer friendly*.

Ideally, use Live-Mutex for shorter lived locking needs (less than an hour), for two reasons:

1. I haven't proved that there are no memory leaks over a long period of time (although things look good).
2. This library does not currently have a backup/secondary system - if the broker goes down for whatever reason, that's it.

For application development, there is no reason not to use Redis or similar,
but for libraries that need a locking mechanism, and for which installing Redis would be too much to ask, then this
will be a good solution. In most cases, this library should outperform other libraries doing concurrent access, this
is because this library uses events instead of polling for its implementation.

This library uses a broker and client model. For any key there should be at most 1 broker. There can be as many
clients as you like. For more than one key, you can use just 1 broker, or a separate broker per key,
depending on how much performance you really need.
