// note: only include dependencies in this file, which are in your project's package.json file
const path = require('path');

if (!path.isAbsolute(process.env.MY_DOCKER_R2G_SEARCH_ROOT || '')) {
  throw new Error('Please set the env var "MY_DOCKER_R2G_SEARCH_ROOT" to an absolute path.');
}

exports.default = {
  
  searchRoot: path.resolve(process.env.MY_DOCKER_R2G_SEARCH_ROOT),
  tests: '',
  packages: {
    
    'example1': true,
    'example2': true,
    '@org/example3': 0  // if it's falsy it will be ignored
    
  }
  
};
