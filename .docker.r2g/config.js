
const path = require('path');
const chalk = require('chalk');

if(!path.isAbsolute(process.env.MY_DOCKER_R2G_SEARCH_ROOT || '')){
  throw new Error(chalk.magenta('Please set the env var "MY_DOCKER_R2G_SEARCH_ROOT" to an absolute path.'));
}


exports.default = {
  
  
  searchRoot: path.resolve(process.env.MY_DOCKER_R2G_SEARCH_ROOT),
  
  // the following packages will be installed in the Docker container using this pattern:
  // npm install /r2g_shared_dir/Users/you/
  
  tests: '',
  
  packages: {
  
    'example1': true,
    'example2': true,
    // if it's falsy it will be ignored
    '@org/example3': 0
    
  }
  
};
