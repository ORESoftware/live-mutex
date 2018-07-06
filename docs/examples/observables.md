

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


##### (For more examples see the test directory)

