

//core
const os = require('os');
const util = require('util');

//project
const sumanServer = require('../create-suman-server');

//////////////////////////////////////////////////////////////////////////////////////////////////


module.exports = function startSumanServer (sumanServerInstalled, sumanConfig, serverName) {

  if (!sumanServerInstalled) {
    throw new Error(' => Suman server is not installed yet => Please use "$ suman --use-server" in your local project.');
  }

  sumanServer({
    //configPath: 'suman.conf.js',
    config: sumanConfig,
    serverName: serverName || os.hostname()
  }, function (err, val) {

    if (err) {
      console.error(err.stack || err);
      process.nextTick(function () {
        process.exit(1);
      });
    }
    else {
      console.log('Suman server should be live at =>', util.inspect(val));
      process.nextTick(function () {
        process.exit(0);
      });

    }

  });

};
