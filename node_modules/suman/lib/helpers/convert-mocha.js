/**
 * Created by Olegzandr on 11/4/16.
 */


const path = require('path');

module.exports = function convertMochaTests (root, src, dest, force) {

  if (!src || !dest) {
    console.log('Please designate a src dir and dest dir for the conversion from Mocha test(s) to Suman test(s).');
    console.log('The correct command is: suman --convert --src=[file/dir] --dest=[dir]');
    return;
  }

  var err = null;

  try {
    require(path.resolve(root + '/' + dest));
  }
  catch (e) {
    err = e;
  }

  if (!force && !err) {
    console.log('Are you sure you want to overwrite contents within the folder with path="' + path.resolve(root + '/' + dest) + '" ?');
    console.log('If you are sure, try the same command with the -f option.');
    console.log('Before running --force, it\'s a good idea to run a commit with whatever source control system you are using.');
    return;
  }

  require('../convert-files/convert-dir')({
    src: src,
    dest: dest
  });

};