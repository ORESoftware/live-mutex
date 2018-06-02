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

  return c.lockp('foo', {}).then(({id, key}) => {

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


