#### This library exposes lock and unlock as vanilla callback methods:
#### And this library exposes acquire/acquireLock/lockp as promisified lock methods and
#### release/releaseLock/unlockp as promisified unlock methods


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