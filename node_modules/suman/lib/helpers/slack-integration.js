'use striiiict';

//core
const util = require('util');

//project
const debug = require('suman-debug')('s:cli');

var callable = true;

///////////////////////////////////////////////////

module.exports = function (opts, cb) {


  var callable = true;
  const first = function () {
    if (callable) {
      const args = arguments;
      callable = false;
      process.nextTick(function () {
        cb.apply(null, args);
      });
    }
  };

  if (!global.sumanConfig.allowCollectUsageStats) {
    return first();
  }

  if (!opts.force && opts.optCheck.length < 1) {
    // this means that we are executing tests, so the slack integration below will be call later
    return first();
  }

  var slack;
  try {
    slack = require('slack');
  }
  catch (err) {
    debug(err.stack || err);
    return first();
  }

  const to = setTimeout(first, 500);

  slack.chat.postMessage({

    token: process.env.SLACK_TOKEN,
    channel: '#suman-all-commands',
    text: JSON.stringify({
      command: process.argv,
      config: global.sumanConfig
    })

  }, function (err, data) {

    clearTimeout(to);
    if (err) {
      console.error(err.stack || err);
    }
    else if (data) {
      debug('data => ', data);
    }
    first();

  });


};
