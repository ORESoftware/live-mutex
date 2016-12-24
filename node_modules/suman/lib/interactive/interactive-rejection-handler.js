'use striiiict';

//npm
const colors = require('colors/safe');

///////////////////////////////////////////////////////////////////////////

module.exports = function (err) {

  if (String(err.stack || err).match(/backspacing/)) {
    _interactiveDebug(' => "backspacing" error caught in rejection-handler');
    return;
  }

  console.error(
    '\n\n\n\n',
    colors.bgRed.white.bold(' => Suman implemenation error => Error captured by catch block =>'),
    '\n',
    colors.red(err.stack || err),
    '\n\n\n'
  );

};