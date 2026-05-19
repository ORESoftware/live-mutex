const fs = require('fs');

const path = require('path');
const p = path.resolve(__dirname + '/../../modules/all-core-and-npm.js');
const strm = fs.createWriteStream(p);

// NOTE: we reference the suman project..
const pkg = require('../../../suman/package.json');
const deps = pkg.dependencies;

strm.write('\n\n');

Object.keys(deps).forEach(function (k) {

  strm.write("require('" + k + "');\n");

});

strm.on('finish', function () {
  process.exit(0);
});

strm.end();


