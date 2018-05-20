import {Broker} from './broker-1';

const port = parseInt(process.argv[2] || process.env.LIVE_MUTEX_PORT || '6970');

new Broker({port: port}).ensure().then(function () {
  console.log(`live-mutex broker is listening on port ${port}.`);
})
.catch(function (err) {
  console.error(err.stack || err);
});



