const fs = require('fs');
const path = require('path');

exports.getTransformStream = function () {
  return fs.createReadStream(exports.getTransformPath());
};

exports.getTransformPath = function(){
  return path.resolve(__dirname + '/index.sh');
};


exports.getListOfCompatiblePlugins = function(){

  return {

    '@run': [
      'suman-run-plugins/plugins/babel-std'
    ]

  }

};