[![Build Status](https://travis-ci.org/ORESoftware/live-mutex.svg?branch=master)](https://travis-ci.org/ORESoftware/live-mutex)

# Live-Mutex

### Disclaimer

Tested on *nix and MacOS - (probably will work on Windows, but not tested on Windows). <br>
Tested and proven on Node.js versions >= 6.0.0.

## About

<b>Live-Mutex is minimum 5x faster than Lockfile and Warlock for concurrent locking requests.</b>
<i>When Warlock and Lockfile are not finely/expertly tuned, 5x becomes more like 30x or 40x.</i>
<i>Live-Mutex should also be much less memory and CPU intensive than Lockfile and Warlock, because Live-Mutex is
fully evented, and Lockfile and Warlock use a polling implementation by nature.</i>

### Why

I used a couple of other libraries and they required manual retry logic and they used polling under the hood to acquire locks.
It was difficult to fine tune those libraries and they were extremely slow for high lock request concurrency. <br>
Other libraries are stuck with polling for simple reasons - the filesystem is dumb, and so is Redis (unless you write some <br>
Lua scripts that can run on there - I don't know of any libraries that do that).<br>
<br>
If we create an intelligent broker that can queue locking requests, <br>
then we can create something that's both more performant and more developer friendly. Enter live-mutex. <br>


# Installation

For command line tools:

## ```$ npm install -g live-mutex```

For usage with Node.js libraries:

## ```$ npm install live-mutex --save```

### Who needs it

1. Library developers who want a very fast application-level locking mechanism (and who cannot install Redis).<br>
2. Application developers using MongoDB (MongoDB has ttl indexes on collections, but this requires a polling implementation).<br>
3. Developers who normally use the Lockfile library, but need something faster, or multi-machine. <br> (Lockfile can really work on
one machine, Live-Mutex can work on a network.)

In more detail:<br>
See: `docs/detailed-explanation.md`


## Alternatives to Live-Mutex

The NPM lockfile library works OK for the same purpose, but Live-Mutex is:

* much more performant than NPM lockfile for real-life scenarios with lots of concurrent lock requests
* does not require any polling, which is why it's more performant
* uses TCP, so could also more easily work across machines, not just across processes on the same machine


## Usage and Best Practices

The Live-Mutex API is completely asynchronous and requires usage of async initialization for both
the client and broker instances. This library requires a Node.js process to run a TCP server. This can be within one of your existing Node.js
processes, or more likely launched separately. In other words, a live-mutex client could also be the broker,
there is nothing wrong with that. For any given key there should be one broker. For absolute speed, you could use separate
brokers (in separate Node.js processes)for separate keys, but that's not really very necessary.

Three things to remember:

1. You need to initialize a broker before connecting any clients, otherwise your clients will pass back an error upon connect().
2. You need to call `ensure()/connect()` on a client or use the asynchronous callback passed to the constructor, before
calling client.lock() or client.unlock().
3. Live-Mutex clients and brokers are *not* event emitters. <br> The two classes wrap Node.js sockets, but the sockets connections
are not exposed to the user of the library.


## You may not need this library:

You do not need this library if you need a mutex for only one (Node.js) process. I would be curious as to why
you'd need/want a locking mechanism in this case.

The same process that is a client can also be the broker. Live-Mutex is designed for this.
You probably only need one broker for any given host, and probably only need one broker if you use multiple keys,
but you can always use more than one broker per host, and use different ports. Obviously, it would not work
to use multiple brokers for the same key, that is the one thing you should not do.

## Do's and Don'ts

* Do use a different key for each different resource that you need to control access to.

* Do use more than one broker, if you have multiple keys, and need maximum performance.

* Do put each broker in a separate process, if you want to.

* Do *not* use more than one broker for the same key, as that will defeat the purpose of locking altogether. Lol.

* Do call `client.ensure()` immediately before every `client.lock()` call, this will allow the client to reconnect if it has a bad state.

<br>

# Examples

## Command line:

The real power of this library comes with usage with Node.js, but we can use <br>
the functionality at the command line too:


```bash

# in shell 1
$ lm_start_server 6970  # 6970 is the default port, so you can omit that

# in shell 2
$ lm_acquire_lock foo 6970  # 6970 is the default port, so you can omit that
$ lm_release_lock foo 6970  # 6970 is the default port, so you can omit that

```

Note to get started with the library, you can simply start a live-mutex broker with:

```bash
lm_start_server # defaults to port 6970
```


## Importing the library using Node.js

```js

const {Broker} = require('live-mutex/broker');
const {Client} = require('live-mutex/client');
const lmUtils = require('live-mutex/utils');

// there are aliases, which are more descriptive:
const {LMBroker, LvMtxBroker} = require('live-mutex/broker');  // these are simply aliases of Broker
const {LMClient, LvMtxClient} = require('live-mutex/client');  // these are simply aliases of Client

// alternatively you can import all of these directly
import {Client, Broker, lmUtils}  from 'live-mutex';

```

## Simple example

To see a complete simple example of using a broker and client in the same process, see:
```=> docs/examples/simple.md```


### A note on default behavior

By default, a lock request will retry 3 times, on an interval defined by `opts.lockRequestTimeout`, which defaults to 3 seconds.
That would mean that the a lock request may fail with a timeout error after 9 seconds.

If there is an error or Promise rejection, the lock was not acquired, otherwise the lock was acquired.
This is nicer than other libraries that ask that you check the type of the second argument, instead of just checking
for the presence of an error.

Unlock requests - there are no builtin retries for unlock requests - if you absolutely need an unlock request to succeed,
use `opts.force = true`. Otherwise, implement your own retry mechanism for unlocking. If you want the library
to implement automatic retries for unlocking, please file an ticket.


### Using the library with Promises (recommended usage)

```js
const opts = {port: '<port>' , host: '<host>'};
// check to see if the websocket broker is already running, if not, launch one in this process

 const client = new Client(opts);

 // calling ensure before each critical section means that we ensure we have a connected client
 return client.ensure().then(c =>  {   // (c is the same object as client)
    return c.acquire('<key>').then(({key,id}) => {
        return c.release('<key>', id);
     });
 });
```

#### Using vanilla callbacks (higher performance + a convenience unlock function)

```js
client.ensure(function(err){
   client.lock('<key>', function(err, unlock){
       // unlock is a convenience function, bound to the right key + request uuid
       unlock(function(err){

       });
   });
});
```

#### If you want the key and request id, use:

```js
client.ensure(function(err){
   client.lock('<key>', function(err, {id, key}){
       client.unlock(key, id, function(err){
           // note that if we don't use the unlock convenience callback,
           // that we should definitely pass the id of the original request.
           // this is for safety - we only want to unlock the corresponding lock,
           // which is defined not just by the right key, but also the right request id.
       });
   });
});
```

// note: using this id ensures that the unlock call corresponds with the original corresponding lock call
// otherwise what could happen in your program is that you could call
// unlock() for a key that was not supposed to be unlocked by your current call


### Usage without the call id (this is less safe):

```js
const client = new Client(opts);
client.ensure(function(err, c){
  c.lock('<key>', function(err){       // c and client are same object
      c.unlock('<key>',function(err){

      });
  });
});

```

As you can see, before any `client.lock()` call, we call `client.ensure()`...this is not imperative, but it is a best practice. <br>
`client.ensure()` only needs to be called once before any subsequent `client.lock()` call. However, the benefit of calling it before every time,
is that it will allow a new connection to be made if the existing one has a bad state.

Any *locking* errors will mostly be due to the failure to acquire a lock before timing out, and should
 very rarely happen if you understand your system and provide good settings/options to live-mutex.

*Unlocking* errors should be very rare, and most likely will happen if the process running the broker goes down
or is overwhelmed. You can simply log unlocking errors, and otherwise ignore them.


## Client constructor and client.lock() method options

There are some important options. All options can be passed to the client constructor instead of the client lock method, which is more convenient and performant:

```js
const c = new Client({port: 3999, ttl: 11000, lockRequestTimeout: 2000, maxRetries: 5});

c.ensure().then(c => {
    // lock will retry a maximum of 5 times, with 2 seconds between each retry
   return c.lock(key);
})
.then(function({key, id, unlock}){

   // we have acquired a lock on the key, if we don't release the lock after 11 seconds
   // it will be unlocked for us.

   // note that if we want to use the unlock convenience function, it's available here

   // runUnlock/execUnlock will return a promise, and execute the unlock convenience function for us
   return c.execUnlock(unlock)
     .catch(e => ({errror:e}));  // we ignore any unlocking errors, which is usually fine
});
```

## The current default values for constructor options:

* `port` => `6970`
* `host` => `localhost`
* `ttl` => `4000`ms. If 4000ms elapses, if the lock still exists, the lock will be automatically released by the broker.
* `maxRetries` => `3`. A lock request will be sent to the broker 3 times before an error is called back.
* `lockRequestTimeout` => `3000`ms. For each lock request, it will timeout after 3 seconds. Upon timeout, it will retry until maxRetries is reached.
* `keepLocksOnExit` => `false`. If true, locks will *not* be deleted if a connection is closed.

As already stated, unless you are using different options for different lock requests for the same client, <br>
simply pass these options to the client constructor which allows you to avoid passing an options object for each <br>
client.lock/unlock call.
  
## Usage with Promises and RxJS5 Observables:
  
  This library conciously uses a CPS interface as this is the most primitive and performant async interface.
  You can always wrap client.lock and client.unlock to use Promises or Observables etc.
  In the docs directory, I've demonstrated how to use live-mutex with ES6 Promises and RxJS5 Observables.
  Releasing the lock can be implemented with (1) the unlock() convenience callback or with (2) both
  the lockName and the uuid of the lock request.
  
  With regard to the Observables implementation, notice that we just pass errors to sub.next() instead of sub.error(),
  but that's just a design decision.


### Usage with Promises:
 => see `docs/examples/promises.md`


### Usage with RxJS5 Observables
 => see `docs/examples/observables.md`


## Live-Mutex utils

To launch a broker process using Node.js:

```js

const lmUtils = require('live-mutex/utils');

lmUtils.conditionallyLaunchSocketServer(opts, function(err){

    if(err) throw err;

      // either this process now owns the broker, or it's already running in a different process
      // either way, we are good to go
      // you don't need to use this utility method, you can easily write your own

      // * the following is our recommended usage* =>
      // for convenience and safety, you can use the unlock callback, which is bound
      // to the right key and internal call-id

  });

```

To see examples of launching a broker using Node.js code, see:

```src/lm-start-server.ts```


To check if there is already a broker running in your system on the desired port, you can use a tcp ping utility
to see if the web-socket server is running somewhere. I have had a lot of luck with tcp-ping, like so:

```js

  const ping = require('tcp-ping');

  ping.probe(host, port, function (err, available) {

        if (err) {
            // handle it
        }
        else if (available) {
            // tcp server is already listening on the given host/port
        }
        else {
           // nothing is listening so you should launch a new server/broker, as stated above
           // the broker can run in the same process as a client, or a separate process, either way
        }
    });


```


<br>

### Live-Mutex supports Node.js core domains
To see more, see: `docs/examples/domains.md`

<br>

## Creating a simple client pool

In most cases, a single client is sufficient, and this is true many types of networked clients using async I/O.
You almost certainly do not need more than one client.
However, if you do some empirical test, and find a client pool might be beneficial/faster, etc. Try this:

```js

const {Client} = require('live-mutex/client');

exports.createPool = function(opts){
  
  return Promise.all([
     new Client(opts).connect(),
     new Client(opts).connect(),
     new Client(opts).connect(),
     new Client(opts).connect()
  ]);
}


```