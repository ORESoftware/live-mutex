

# Live-Mutex

This library is useful for developers who have their own library and need a multi-process locking mechanism, but may find it
inconvenient or impossible to install or use Redis or similar. This library offers lightweight, safe, and high-performance locking. 
For example, it is lighter-weight than installing Redis, but offers the same locking
features that Redis would offer, if not much more user friendly. For application development, there is no reason not to use Redis or similar,
but for libraries that need a locking mechanism, and for which installing Redis would be too much to ask, then this
will be a good solution.

## ```$ npm install --save live-mutex ```

## Disclaimer
Tested on MacOS and *nix, probably will not work on Windows

## Alternatives

The NPM lockfile library works OK for the same purpose, but live-mutex is:

* probably much faster
* does not require any polling
* uses websockets, so could also more easily work across machines, not just across processes on the same machine
* I would have just used NPM lockfile, but I saw some weird behavior/bugs that I could not rationalize, so I decided
to write something that I understood and might perform better.


## Usage
This library requires a Node.js process to run a websocket server. This can be within one of your existing Node.js
processes, or more likely launched separately. In other words, a live-mutex client could also be the broker,
there is nothing wrong with that. For any given key there should be one broker. For absolute speed, you could use separate
brokers (in separate Node.js processes)for separate keys, but that's not really very necessary.


## You may not need this library
You do not need this library if you need a mutex for only one (Node.js) process. I would be curious as to why
you'd need a locking mechanism for Node.js, in this case.

The same process that is a client can also be the broker. Live-Mutex is designed for this.
You probably only need one broker for any given host, and probably only need one broker if you use multiple keys,
but you can always use more than one broker per host, and use different ports. Obviously, it would not work
to use multiple brokers for the same key, that is the one thing you should not do.


## Do's and Don'ts
Do use a different key for each different resource that you need to control access to.
Do use more than one broker, if you have multiple keys, and need maximum performance.
Do put each broker in a separate process, if you want.
Do not use more than one broker for the same key, as that will defeat the purpose of locking altogether.


# Code examples

```js

// exports:

const Broker = require('live-mutex/broker');
const Client = require('live-mutex/client');
const lmUtils = require('live-mutex/utils');

```

To check if there is already a broker running in your system on the desired port, you can use a tcp ping utility
to see if the web-socket server is running somewhere:

```js
const opts = {port: '<port>' , host: '<host>'};

// check to see if the websocket broker is already running, if not, launch one in this process

// you can probably find a synchronous way to do this
// (although not a lot of network I/O libraries in the Node.js
//  world have any synchronous methods/functions)

lmUtils.conditionallyLaunchSocketServer(opts, function(err){
           
      // either this process now owns the broker, or it's already running in a different process
      // either way, we are good to go
      // you don't need to use this utility method, you can easily write your own
      
      const client = new Client(opts);
     
      
      //  simple usage with key
       client.lock('<key>', function(err){
           //handle error
           client.unlock('<key>',function(err){
           // handle error, although unlocking errors should be very rare
           });
       });
       
       // *recommended usage* => for convenience and safety, you can use the unlock callback, which is bound
       // to the right key and internal call id for safety
      client.lock('<key>', function(err, unlock){
              // hanlde potential error
           unlock(function(err){
               // handle err, although unlocking errors should be very rare
           });
       });
      
      // using the unlock callback is basically equivalent to doing this:
       client.lock('<key>', function(err, unlock, id){
                    // hanlde potential error
            client.unlock('<key>', id, function(err){
                 // handle err, although unlocking errors should be very rare
            });
        });
       
       // using this id ensures that the unlock call corresponds with the lock call,
       // otherwise what could happen in your program is that you could call
       // unlock for a key that was not supposed to be unlocked by your current call
      
      
});
```