'use strict';

const fs = require('fs');
const path = require('path');

const writeMarker = name => {
  return (root, cb) => {
    try {
      const dir = path.resolve(root, '.r2g-markers');
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(path.resolve(dir, `${name}.txt`), `${name}\n`);
      cb();
    }
    catch (err) {
      cb(err);
    }
  };
};

exports.default = {
  inProjectBeforeInstall: [writeMarker('before-install')],
  inProjectAfterInstall: [writeMarker('after-install')]
};
