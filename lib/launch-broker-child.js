const {Broker} = require('../broker');

const port = parseInt(String(process.env.LIVE_MUTEX_PORT));

new Broker({port: port}).ensure().then(function () {
  console.log(`live-mutex broker is listening on port ${port}.`);
}).catch(function (err) {
  console.error(err.stack || err);
});



