

# Live-Mutex

This library is useful for developers who have a library and need a multi-process locking mechanism, but may find it
inconvenient or impossible to use Redis or similar type of installation. This library offers a lightweight possibility
of doing high-performance locking.

## ```$ npm install --save live-mutex ```

## Alternatives

NPM lockfile library works OK for the same purpose, but this library is:

* faster
* does not require polling
* uses websockets, so could also more easily work across machines, not just across processes


## Usage
This library requires a Node.js process to run a websocket server. This can be within one of your existing Node.js
processes, or more likely launched separately.


## You may not need this library
You do not need this library if you need a mutex for only one (Node.js) process. I would be curious as to why
you'd need a locking mechanism for Node.js, in this case.


# Code examples