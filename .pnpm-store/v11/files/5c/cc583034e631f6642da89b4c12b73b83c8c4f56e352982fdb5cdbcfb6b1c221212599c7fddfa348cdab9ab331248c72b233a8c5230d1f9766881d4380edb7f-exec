# Poolio

[![Build Status](https://travis-ci.org/ORESoftware/poolio.svg?branch=master)](https://travis-ci.org/ORESoftware/poolio)


##  => a versatile process pool for Node.js

* create a pool of N workers
* define the start script for each worker in the pool
* kill workers after each task and automatically generate a new worker on exit, or more likely, reuse the same
workers for the lifecycle of the worker pool.
* dynamically add or remove workers at will

<br>
<br>

<a href="https://nodei.co/npm/poolio/"><img src="https://nodei.co/npm/poolio.png?downloads=true&downloadRank=true&stars=true"></a>

<br>
<br>

This module behaves much like these two pre-existing modules:

* core: https://nodejs.org/api/cluster.html#cluster_cluster_setupmaster_settings
* userland: https://github.com/thisandagain/fork-pool

This module strives for a better implementation and simpler API. Like the above,
this lib utilizes a child_process pool, using child_process.fork() like so: 


```javascript

const cp = require('child_process');
const n = cp.spawn('node',['<your-worker-script>']);

```

## Installation

```bash
npm install -S poolio
```

## Basic Use

```js

const {Pool} = require('poolio');

// in the current process, we initialize a pool
const pool = new Pool({
    filePath: 'child.js',    //path is relative to root of your project, but it's best to pass in an absolute path
    size: 3
});


function rankPostsUsingWorkerPool(postIds){

   return pool.anyp({action: 'run', posts: postIds})
    .then(function(){
        log.info('successfully processes post ranking.');
    })
    .catch(function (err) {
        log.error(err);
    });
    
}
       

// in a child process - simple example

process.on('message', function (data) {   //use the closure, it is better that way

    const workId = data.workId;
    
    var result;
    
    try{
    
     result = doSomeIntensiveWork();
     
     process.send({
        msg: 'done/return/to/pool',
        error: null,
        workId: workId,
        result: result
     });
     
    }
    catch(err){
        process.send({
            msg: 'error',
            error: err.stack,
            workId: workId,
            result: null
         });
    }
    
    
    
    function doSomeIntensiveWork(){
    
       // ....
    
        return 'some-very-special-result';
    
    }
    
    
});


```

## Advanced use

```js

// in the parent process, we require the module and initialize a pool

const Pool = require('poolio');

const pool = new Pool({
    filePath: 'child.js',    //path is relative to root of your project
    size: 5
});


function doHeavyDataIntensiveAsyncWork(data){
    return pool.anyp({action: 'all', data: data}); // return the promise
}
       

// in a child process - advanced example

const _ = require('lodash');
const domain = require('domain');


process.on('message', function (data) {   //use the closure, it is better that way

    const workId = data.workId;
    const d = domain.create();
    
    d.once('error', function(err){
       this.exit();
       process.send({
         msg: 'error',
         error: err.stack,
         workId: workId,
         result: null
       });
    
    });
    
    d.run(function(){
    
    const actions = [];
    
    switch(data.action){
    
         case 'foo':
           actions.push(foo);
           break;
         case 'bar':
           actions.push(bar);
           break;
         case 'baz':
           actions.push(baz);
           break;
         case 'all':
           actions.push(foo);
           actions.push(bar);
           actions.push(baz);
           break;
         default:
           throw new Error('No case matched'); //will be caught by domain.on('error')
    
    }
    
    
       Promise.all(actions).then(function(result){
       
           process.send({
              msg: 'done/return/to/pool',
              result: result,
              workId: workId
              error: null
           });
    
       });
    
    
    });
    
    function foo(){
       
       return new Promise(function(resolve,reject){
       
            // ....do some async work...
        
       })
       
    }
    
    
    function bar(){
    
        return new Promise(function(resolve,reject){
             
            // ....do some async work...
              
        })
    
    }
    
    function baz(){
    
       return new Promise(function(resolve,reject){
              
           // ....do some async work...
               
       })
    }
    
    
});


```

