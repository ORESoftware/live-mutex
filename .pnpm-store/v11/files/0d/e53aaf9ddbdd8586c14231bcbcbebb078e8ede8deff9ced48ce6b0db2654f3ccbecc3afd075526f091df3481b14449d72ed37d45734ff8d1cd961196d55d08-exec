const fs = require('fs');
const path = require('path');

exports.getRunStream = function () {
  return fs.createReadStream(exports.getRunPath());
};

exports.getRunPath = function(){
  return path.resolve(__dirname + '/index.sh');
};

exports.getPluginName = function(){
  return path.dirname(__filename);
};