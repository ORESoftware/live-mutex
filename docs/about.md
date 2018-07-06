
# More info about Live-Mutex


## You may not need this library:

You do not need this library if you need a mutex for only one (Node.js) process. I would be curious as to why
you'd need/want a locking mechanism in this case. For synchronization in a single process, you can
find a must more performant solution elsewhere. Live-Mutex performance is good when doing multi-process
synchronization.

### Who needs it

1. Library developers who want a very fast application-level locking mechanism (and who cannot install Redis or other distributed locking system).<br>
2. Application developers using MongoDB (MongoDB has ttl indexes on collections, but this requires a polling implementation).<br>
3. Developers who normally use the Lockfile library, but need something faster, or multi-machine. <br> (Lockfile can really work on one machine, Live-Mutex can work on a network.)


## Alternatives to Live-Mutex

The NPM lockfile library works OK for the same purpose, but Live-Mutex is:

* much more performant than NPM lockfile for real-life scenarios with lots of concurrent lock requests
* does not require any polling, which is why it's more performant
* uses TCP, so could also more easily work across machines, not just across processes on the same machine


## Do's and Don'ts

* Do use a different key for each different resource that you need to control access to.

* Do use more than one broker, if you have multiple keys, and need maximum performance.

* Do put each broker in a separate process, if you want to.

* Do *not* use more than one broker for the same key, as that will defeat the purpose of locking altogether. Lol.

* Do call `client.ensure()` immediately before every `client.lock()` call, this will allow the client to reconnect if it has a bad state.