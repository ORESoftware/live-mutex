[![Build Status](https://travis-ci.org/ORESoftware/live-mutex.svg?branch=master)](https://travis-ci.org/ORESoftware/live-mutex)

# Live-Mutex

### Disclaimer

Tested on *nix and MacOS - (probably will work on Windows, but not tested on Windows). <br>
Tested and proven on Node.js versions > 4.0.0.

## About

<b>Live-Mutex is minimum 5x faster than Lockfile and Warlock for concurrent locking requests.</b>
<i>When Warlock and Lockfile are not finely/expertly tuned, 5x becomes more like 30x or 40x.</i>
<i>Live-Mutex should also be much less memory and CPU intensive than Lockfile and Warlock, because Live-Mutex is
fully evented, and Lockfile and Warlock use a polling implementation by nature.</i>

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
This library is useful for developers who need a multi-process locking mechanism, but may find it
inconvenient or impossible to use Redis, or similar proven mutex brokers. In other words, this library is designed to support other 
libraries more so than applications. 

Live-Mutex offers lightweight (non-polling), safe (prevents you from unlocking a lock by accident),
and high-performance (faster than anything else) locking.

It offers the same locking features that Redis-related libraries would offer, but should be more developer friendly. 

Ideally, use Live-Mutex for shorter lived locking needs (less than an hour), for two reasons:

1. I haven't proved that there are no memory leaks over time (although things look good).
2. This library does not currently have a backup/secondary system - if the broker goes down for whatever reason, that's it.

For application development, there is no reason not to use Redis or similar,
but for libraries that need a locking mechanism, and for which installing Redis would be too much to ask, then this
will be a good solution. In most cases, this library should outperform other libraries doing concurrent access, this
is because this library uses events instead of polling for its implementation.

This library uses a broker and client model. For any key there should be at most 1 broker. There can be as many
clients as you like. For more than one key, you can use just 1 broker, or a separate broker per key,
depending on how much performance you really need.



## Alternatives to Live-Mutex

The NPM lockfile library works OK for the same purpose, but Live-Mutex is:

* much more performant than NPM lockfile for real-life scenarios with lots of concurrent lock requests
* does not require any polling, which is why it's more performant
* uses TCP, so could also more easily work across machines, not just across processes on the same machine


## Usage and Best Practices

The Live-Mutex API is completely asynchronous and requires usage of async initialization for both
the client and broker instances. You can initialize a client or broker in a few different ways.

This library requires a Node.js process to run a TCP server. This can be within one of your existing Node.js
processes, or more likely launched separately. In other words, a live-mutex client could also be the broker,
there is nothing wrong with that. For any given key there should be one broker. For absolute speed, you could use separate
brokers (in separate Node.js processes)for separate keys, but that's not really very necessary.

Three things to remember:

1. You need to initialize a broker before initializing any clients, otherwise your clients will pass back an error upon connect().
2. You need to call `ensure()` on a client or use the asynchronous callback passed to the constructor, before
calling client.lock() or client.unlock().
3. Live-Mutex clients and brokers are not (currently) event emitters. <br> The two classes wrap Node.js sockets, but the sockets
are not exposed to the user of the library.


## You may not need this library:

You do not need this library if you need a mutex for only one (Node.js) process. I would be curious as to why
you'd need/want a locking mechanism in this case.

The same process that is a client can also be the broker. Live-Mutex is designed for this.
You probably only need one broker for any given host, and probably only need one broker if you use multiple keys,
but you can always use more than one broker per host, and use different ports. Obviously, it would not work
to use multiple brokers for the same key, that is the one thing you should not do.


## Do's and Don'ts
<br>
Do use a different key for each different resource that you need to control access to. <br>
Do use more than one broker, if you have multiple keys, and need maximum performance. <br>
Do put each broker in a separate process, if you want to. <br>
Do not use more than one broker for the same key, as that will defeat the purpose of locking altogether. <br>


# Examples


### Command line:

The real power of this library comes with usage with Node.js, but we can use <br>
the functionality at the command line too:


```bash

# in shell 1
lm_start_server 6970

# in shell 2
lm_acquire_lock foo
lm_release_lock foo

```


### Importing the library

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
## Using the library with vanilla callbacks

```js
const opts = {port: '<port>' , host: '<host>'};
// check to see if the websocket broker is already running, if not, launch one in this process

lmUtils.conditionallyLaunchSocketServer(opts, function(err){
    
    if(err) throw err;
           
      // either this process now owns the broker, or it's already running in a different process
      // either way, we are good to go
      // you don't need to use this utility method, you can easily write your own
      
      // * the following is our recommended usage* =>
      // for convenience and safety, you can use the unlock callback, which is bound
      // to the right key and internal call-id 
             
     // here is the recommended way with promises
     
     const client = new Client(opts);
     // calling ensure before each critical section means that we ensure we have a connected client
     return client.ensure().then(c =>  {
       return client.acquire('<key>').then(({key,id}) => {
             return client.release('<key>', id);
         });
     });
       
       
   // using vanilla callbacks (higher performance + a convenience unlock function)
    client.ensure(function(err){
       // handle any err your way
       client.lock('<key>', function(err, unlock){
            // handle any err your way
             unlock(function(err){  // unlock is bound to the right key and request uuid
                 // handle any err your way, p
             });
       });
    });
    
   
      
    // note: using this id ensures that the unlock call corresponds with the original corresponding lock call
    // otherwise what could happen in your program is that you could call
    // unlock() for a key that was not supposed to be unlocked by your current call
        
        
    //  simple usage without the call id (this is less safe):
    const client = new Client(opts);
    
    client.ensure().then(function(c){
      c.lock('<key>', function(err){       // c and client are same object
          c.unlock('<key>',function(err){
                     
          });
      });      
    });
      
});


```

Any *locking* errors will mostly be due to the failure to acquire a lock before timing out, and should
 very rarely happen if you understand your system and provide good settings/options to live-mutex.

*Unlocking* errors should be very rare, and most likely will happen if the process running the broker goes down
or is overwhelmed.

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

  
## Usage with Promises and RxJS5 Observables:
  
  This library conciously uses a CPS interface as this is the most primitive async interface.
  You can always wrap client.lock and client.unlock to use Promises or Observables etc.
  Below I have demonstrated making live-mutex usable with ES6 Promises and RxJS5 Observables. 
  Releasing the lock can be implemented with (1) the unlock() convenience callback or with (2) both
  the lockName and the uuid of the lock request.
  
  With regard the Observables implementation, notice that we just pass errors to sub.next() instead of sub.error(), 
  but that's just a design decision.
  
  Below, we assume you have created a connected client. It's best to avoid having to call `client.ensure()` for every
  request. Simply call `client.ensure()` once, when your application starts up.
  
  
### Usage with Promises:

This library exports `acquire/acquireLock` and `release/releaseLock` methods for the client,<br>
which are simply implemented like so:

```typescript

  acquire(key: string, opts?: Partial<IClientLockOpts>) {
    return new Promise((resolve, reject) => {
      this.lock(key, opts, function (err, v) {
        err ? reject(err) : resolve(v);
      });
    });
  }

  release(key: string, opts?: Partial<IClientUnlockOpts>) {
    return new Promise((resolve, reject) => {
      this.unlock(key, opts, function (err, val) {
        err ? reject(err) : resolve(val);
      });
    });
  }
  
  acquireLock(key: string, opts?: Partial<IClientLockOpts>) {
     // same as acquire
  }

  releaseLock(key: string, opts?: Partial<IClientUnlockOpts>) {
      // same as release
  }
 
  lockp(key: string, opts?: Partial<IClientLockOpts>) {
     // same as acquire
  }

  unlockp(key: string, opts?: Partial<IClientUnlockOpts>) {
      // same as release
  }
  
```

## To use these methods with async/await, it simply looks like:

```js
    await client.lockp('a');
    await Promise.delay(100);
    await client.unlockp('a');
```

you can also use the unlock() convenience callback like so:

```js
    return c.lockp('foo').then(function ({unlock}) {
      return new Promise(function (resolve, reject) {
        unlock(function (err, v) {
          err ? reject(err) : resolve(v);
        });
      });
    });

```



### Usage with RxJS5 Observables
 => see docs/examples.md
  
### Usage with ES6 Promises
 => see docs/examples.md


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