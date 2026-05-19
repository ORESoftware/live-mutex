// const residence = require('residence');
// const projectRoot = residence.findProjectRoot(process.cwd());


const path = require('path');
const util = require('util');

const npmDepsToLoad = [
  'async',
  'lodash',
  'lockfile',
  'function-arguments',
  'pragmatik',
  'colors',
  'ascii-table',
  'residence',
  'rimraf',
  'semver',
  'siamese',
  'tcp-ping',
  'socket.io',
  'socket.io-client',
  'suman-utils',
  'suman-events',
  'underscore',
  'replacestream'
];

const sumanFilesToLoad = [
  'lib/index.js',
];

process.once('message', function (m) {

  (m.msg.argv || []).forEach(function(v){
    process.argv.push(v);
  });

  setImmediate(function () {
    require(m.msg.testFilePath);
  });
});

process.once('SIGINT', function(){
  console.log('SIGINT received by suman-d.');
  process.exit(1);
});


try {
  const sumanIndex = require.resolve('suman');
  const sumanRoot = residence.findProjectRoot(sumanIndex);

  npmDepsToLoad.forEach(function (dep) {
    try {
      require(path.resolve(sumanRoot + '/node_modules/' + dep));
    }
    catch(err){
      console.error(err.message || err);
    }
  });

  sumanFilesToLoad.forEach(function (dep) {
    try {
      require(path.resolve(sumanRoot + '/' + dep));
    }
    catch(err){
      console.error(err.message || err);
    }
  });

}
catch (err) {
  console.log(err.message || err);
}

console.log('Suman is loaded, waiting for test file input...');







