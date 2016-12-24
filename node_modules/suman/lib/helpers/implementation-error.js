/**
 * Created by Olegzandr on 11/4/16.
 */



module.exports = function handleUnexpectedErrorArg (err, isThrow) {
  if (err) {
    const $err = new Error(' => Suman implementation error => Please report!'
      + '\n' + (err.stack || err));
    console.error($err.stack);
    global._writeTestError($err.stack);
    if (isThrow) {
      throw $err;
    }
  }
};