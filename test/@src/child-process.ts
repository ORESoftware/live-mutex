const lmUtils = require('live-mutex/utils');

lmUtils.launchBrokerInChildProcess({port: 3061}, function (err, data) {

  if (err) {
    throw err;
  }

  console.log('data => ', data);

});