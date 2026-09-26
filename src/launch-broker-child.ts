'use strict';

import {Broker1} from './broker-1-hardened';

const port = parseInt(process.argv[2] || process.env.LIVE_MUTEX_PORT || '6970');

new Broker1({port: port}).ensure().then(function () {
  console.log(`live-mutex broker is listening on port ${port}.`);
})
.catch(function (err) {
  console.error(err.stack || err);
});
