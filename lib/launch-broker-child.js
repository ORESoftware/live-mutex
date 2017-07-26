const {Broker} = require('../broker');

new Broker({port: parseInt(process.env.LIVE_MUTEX_PORT)}).ensure().then(function () {
  console.log('live-mutex broker is listening.');
}).catch(function (err) {
  console.error(err.stack || err);
});



