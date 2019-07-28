
const {Client, Broker} = require('../dist/main');

const client = new Client();
const broker = new Broker();


Promise.all([
  broker.start(),
  client.ensure()
])
.then(([b, c]) => {

  client.ensure().then(c => {
    return c.lockp('status');   // c.acquire and c.acquireLock are aliases to c.lockp
  })
  .then(({id, key}) => {
    console.log('Lock acquired key: ', key, '\tid:', id);
    return new Promise((resolve) => setTimeout(resolve, 300));
  })
  .then(() => {
    return client.ensure();
  })
  .then(c => {
    console.log('Releasing key: ', 'status');
    return c.unlockp('status');   // c.release and c.releaseLock are aliases to c.unlockp
  });

});


