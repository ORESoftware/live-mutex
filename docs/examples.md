
### For more examples see the test directory


### Example usage with RxJS5 Observables

```js

   import {Observable} from 'rxjs/Rx';
  
   exports.acquireLock = function (client, key) {
  
      return Observable.create(sub => {
  
          client.lock(key,  (err, {unlock, id, key}) => {
          
              if (err) {
                  console.error('Error acquiring lock => ', err);
              }
  
              sub.next({
                  unlock,
                  error: err,
                  id,
                  key
              });
  
              sub.complete();
  
          });
  
          return function () {
              console.log('disposing acquireLock()');
          }
      });
  };
  
   exports.releaseLock = function (client, key, id) {
  
      return Observable.create(sub => {
  
          client.unlock(key, id,  err => {
  
              if (err) {
                  console.error('Release lock error => ', err);
              }
            
              sub.next({
                 error: err
              });
  
              sub.complete();
  
          });
  
          return function () {
               console.log('disposing releaseLock()');
          }
      });
  };
   
   // alternatively, if you just pass the unlock convenience function, you can simply do:
    exports.releaseLock = function (unlock) {
     
         return Observable.create(sub => {
     
             unlock(err => {
     
                 if (err) {
                     console.error('Release lock error => ', err);
                 }
               
                 sub.next({
                    error: err
                 });
     
                 sub.complete();
     
             });
     
             return function () {
                  console.log('disposing releaseLock()');
             }
         });
     };

```


#### This library exposes lock and unlock as vanilla callback methods:
#### And this library exposes acquire/acquireLock/lockp as promisified lock methods and
#### release/releaseLock/unlockp as promisified unlock methods 

###### As an example this is basically how they are implemented

```js

exports.acquireLock = function(lockName){
  return new Promise((resolve,reject) => {
    client.lock(lockName, function(err, v){
      err ? reject(err) : resolve(v);
    });
  });
};

exports.releaseLock = function(lockName, lockUuid){
   return new Promise((resolve,reject) => {
      client.unlock(lockName, lockUuid, function(err,v){
          err ? reject(err): resolve(v);
      });
    });
};

// alternatively, if you use the unlock convenience function, 
// releaseLock can be implemented more simply as:

exports.releaseLock = function(unlock){
   return new Promise((resolve,reject) => {
      unlock(function(err){
          err ? reject(err): resolve();
      });
    });
};


```