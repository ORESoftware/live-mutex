

import lmUtils = require('../../utils');

lmUtils.launchBrokerInChildProcess({port:7888}, function (err, result) {
  
  if(err) throw err;
  
  console.log(result);
  
});