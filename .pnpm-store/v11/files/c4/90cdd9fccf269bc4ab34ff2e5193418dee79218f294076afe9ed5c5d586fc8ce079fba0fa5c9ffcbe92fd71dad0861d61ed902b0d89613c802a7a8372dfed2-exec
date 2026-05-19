'use strict';

const path = require('path');

if (!path.isAbsolute(process.env.MY_DOCKER_R2G_SEARCH_ROOT || '')) {
  throw new Error('Please set the env var "MY_DOCKER_R2G_SEARCH_ROOT" to an absolute path.');
}

exports.default = {

  searchRoot: path.resolve(process.env.MY_DOCKER_R2G_SEARCH_ROOT),

  // the following packages will be installed in the Docker container using this pattern:
  // npm install /r2g_shared_dir/Users/you/

  tests: '',

  packages: {
    'residence': true,
    'vamoot': true,
    'proxy-mcproxy': true,
    'prepend-transform': true,
    'log-prepend': true,
    'pragmatik': true,
    'frankenstop': true,
    'poolio': true,
    'freeze-existing-props': true,
    'json-stdio': true,
    'suman-r': true,
    'suman-types': true,
    'suman-browser': true,
    'suman-watch': true,
    'suman-shell': true,
    'suman-utils': true,
    'suman-events': true,
    'suman-daemon': true,
    'suman-browser-polyfills': true,
    'suman-watch-plugins': true,
    'suman-run-plugins': true,
    'suman-transform-plugins': true,
    'suman-reporters': true,
    'suman-interactive': true
  }

};
