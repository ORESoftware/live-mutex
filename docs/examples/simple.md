

Here is a simple example of starting a broker and creating a client with the Promise API:

```js
const {Client, Broker} = require('live-mutex');

Promise.all([
  new Broker().ensure(),
  new Client().connect()
])
.then(function ([b, c]) {

  b.emitter.on('warning', function () {
    console.error(...arguments);
  });

  c.emitter.on('warning', function () {
    console.error(...arguments);
  });

  return c.lockp('foo').then(({id, key}) => {

    return c.unlockp(key, id).then(v => {

      c.close();
      process.exit(0);

    });
  });

})
.catch(e => {
  console.error(e);
  process.exit(1);
});
```

here is the same example as above but more condensed and with comments:

```js

Promise.all([
  new Broker().ensure(),
  new Client().connect()   // new Client().connect() is just an alias to new Client().ensure() 
])
.then(function ([b, c]) {

   // warnings won't really help with application logic, but will help you debug problems
   // if you do not attach listeners to b and c, then process.emit('warning') will be used by the lib
   
  b.emitter.on('warning', function () {
    console.error(...arguments);
  });

  c.emitter.on('warning', function () {
    console.error(...arguments);
  });

  return c.lockp('foo');   // c.acquire and c.acquireLock are aliases to c.lockp

})
.then(({id, key}) => {

  return c.unlockp(key, id);   // c.release and c.releaseLock are aliases to c.unlockp

});
.catch(e => {
  console.error(e);
  process.exit(1);
});

```
