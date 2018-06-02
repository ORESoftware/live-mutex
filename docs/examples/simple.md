

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

here is the same example as above but more condensed:

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
