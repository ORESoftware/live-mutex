const fs = require('fs');
const path = require('path');

exports.getTransformStream = function () {
  return fs.createReadStream(exports.getTransformPath());
};

exports.getTransformPath = function () {
  return path.resolve(__dirname + '/index.sh');
};

exports.getListOfCompatiblePlugins = function () {
  
  return {
    
    '@run': [
      {
        location: 'npm',
        value: 'suman-run-plugins/plugins/typescript-std'
      }
    ]
    
  }
  
};