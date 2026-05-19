const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname + '/../../modules/global.js');
const strm = fs.createWriteStream(p);


function stringify(val){
  var cache = [];
  return JSON.stringify(val, function(key, value) {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        // Circular reference found, discard key
        return;
      }
      // Store value in our collection
      cache.push(value);
    }
    return value;
  });
}

strm.write('const global = {');

Object.keys(global).forEach(function (k) {

  strm.write('\n\n');

  if (typeof global[k] !== 'function') {
    strm.write(' ' + k + ':' + (stringify(global[k]) || 'null') + ',');
  }

});

Object.keys(global).forEach(function (k) {

  strm.write('\n\n');

  if (typeof global[k] === 'function') {
    strm.write('  ' + k + ' : function(){\n' +
      '  const args = Array.from(arguments);\n' +
      '  setTimeout(function(){\n' +
      '     try { args[args.length-1](\'global will not work as we are in browser error\') } catch(err){}\n' +
      '  },5);\n' +
      '  return {};\n' +
      '},');
  }

});

strm.write('\n};\n\n');
strm.write('module.exports = global;\n\n');

strm.on('finish', function () {
  process.exit(0);
});

strm.end();


