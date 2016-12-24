'use striiiict';

//core
const path = require('path');
const util = require('util');

//npm
const sumanUtils = require('suman-utils/utils');


var loaded = false;

module.exports = function (paths) {

  if (loaded) {
    return;
  }
  else {
    loaded = true;
  }

  const projectRoot = global.projectRoot;

  paths.forEach(function (p) {

    p = path.isAbsolute(p) ? p : path.resolve(projectRoot + path.sep + p);

    const shared = sumanUtils.findSharedPath(p, projectRoot);

    if (String(shared) !== String(projectRoot)) {
      if (!global.sumanOpts.fforce) {
        throw new Error('Looks like you issued the Suman command from the wrong directory, ' +
          'please cd to the relevant project.\n' +
          ' => It appears that you wanted to execute Suman on this path => "' + colors.magenta(p) + '"\n' +
          ' But your current working directory is => "' + colors.cyan(process.cwd()) + '"\n' +
          ' If you think this message is totally wrong and you\'d like to ignore it, use the --fforce option.\n' +
          ' However, most likely you will end up using the <sumanHelpersDir> from the wrong project\n' +
          ' and end up writing to log files in the wrong project.');
      }
    }
  });
};