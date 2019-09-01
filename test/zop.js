const util = require('util');

const inspectError = (err) => {
  return typeof err === 'string' ? err : util.inspect(err, {
    showHidden: true,
    depth: 5
  });
};


console.log(inspectError(new Error('bop')));