

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

const Broker = require('live-mutex/broker');
const Client = require('live-mutex/client');
const lmUtils = require('live-mutex/utils');


The same process that is a client can also be the broker. live-mutex is designed for this.
You probably only need one broker for any given host, but you can always use more per host, and use different ports.

To check if there is already a broker running on your system on the desired port, you can use:

const opts = {port: <port> , host: <host>};

lmUtils.conditionallyLaunchSocketServer().then(function(){
           
      // either this process now owns the broker, or it's already running in a different process
      // either way, we are good to go
      // you don't need to use this utility method, you can easily write your own
      
      const client = new Client(opts);
      
      // > use promises
      client.lock(<key>).then(function(){
            return client.unlock(<key>)
      }, function(err){
           // errors are unlikely, just log something
           // if an error is passed, the lock was not had, so no need to call unlock
           console.error(err.stack || err);
      });
      
      // > use promises
       client.lock(<key>, function(){
          return client.unlock(<key>)
       });
      
});