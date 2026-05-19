'use strict';

// NOTE : the only dependencies you should import here are core/built-in modules
const path = require('path');

const searchRoot = path.resolve(process.env.MY_DOCKER_R2G_SEARCH_ROOT || process.env.HOME || '');

if (!path.isAbsolute(searchRoot)) {
  throw new Error('Please set the env var "MY_DOCKER_R2G_SEARCH_ROOT" to an absolute folder path,' +
    ' (note that user $HOME is usually not specific enough, and also that $HOME env var is empty).');
}

exports.default = {

  searchRoot,
  tests: '',
  packages: {}

};
