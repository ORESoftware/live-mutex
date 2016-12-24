'use striiiict';

//core
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const util = require('util');

//npm
const colors = require('colors/safe');
const _ = require('lodash');
const async = require('async');
const debug = require('suman-debug')('s:files');

//project
const sumanUtils = require('suman-utils/utils');
const constants = require('../../config/suman-constants');
const events = require('suman-events');
const resultBroadcaster = global.resultBroadcaster = global.resultBroadcaster || new EE();


/////////////////////////////////////////////////////////////////////////////

const ACCEPTED_CHILD_FILE_EXTENSIONS = constants.ACCEPTED_CHILD_FILE_EXTENSIONS;

//these are defined at top of ./index.js
const matchesAny = global.sumanMatchesAny;
const matchesNone = global.sumanMatchesNone;
const matchesAll = global.sumanMatchesAll;

assert(Array.isArray(matchesAll), ' => Suman internal error => matchesAll is not defined as array type.');
assert(Array.isArray(matchesNone), ' => Suman internal error => matchesNone is not defined as array type.');
assert(Array.isArray(matchesAll), ' => Suman internal error => matchesAll is not defined as array type.');


///////////////////////////////////////////////////////////////////////////////////////////

module.exports = function getFilePaths(dirs, opts, cb) {

  const projectRoot = global.projectRoot;

  debug([' => Test files will be run if they match any of:', matchesAny], function () {
    return global.sumanOpts.verbose = true && matchesAny.length > 0;
  });

  debug([' => But test files will *not* run if they match any of:', matchesNone], function () {
    return global.sumanOpts.verbose = true && matchesNone.length > 0;
  });

  debug([' => Test files will *not* run if they don\'t match all of:', matchesAll], function () {
    return global.sumanOpts.verbose = true && matchesAll.length > 0;
  });


  var files = [];
  const filesThatDidNotMatch = [];
  // as soon as we are told to run a non-JS file, we have to flip the following boolean
  var nonJSFile = false;

  function doesMatchAll(filename) {
    return matchesAll.every(function (regex) {
      const val = String(filename).match(regex);
      if (!val) {
        filesThatDidNotMatch.push({
          filename: filename,
          regexType: 'matchAll',
          regex: 'The filename did not match the following regex' +
          ' and therefore was excluded => ' + [regex],
        });
      }
      return val;
    });
  }

  function doesMatchAny(filename) {   // we return true if filename matches any regex
    const val = !matchesAny.every(function (regex) {
      return !String(filename).match(regex);
    });

    if (!val) {
      filesThatDidNotMatch.push({
        filename: filename,
        regexType: 'matchAny',
        regex: 'The filename did not match any of the following regex(es) => '
        + matchesAny.map(i => i.toString().slice(1, -1))
      });
    }

    return val;
  }

  function doesMatchNone(filename) { // we return true if filename matches any regex
    return matchesNone.every(function (regex) {
      const val = !String(filename).match(regex);
      if (!val) {
        filesThatDidNotMatch.push({
          filename: filename,
          regexType: 'matchNone',
          regex: 'The filename matched the following regex and was therefore excluded => ' + [regex],

        });
      }
      return val;
    });
  }

  (function runDirs(dirs, count, cb) {

    /*
      NOTE: Count keeps track of depth, 0 is first depth
     */

    async.eachLimit(dirs, 5, function (dir, cb) {

      // important!! we need to resolve *full* path to file before matching against any/call, but for none, we can match against
      // non full/complete file path, think about it, e.g.,
      // foo/node_modules/x/y/z, if node_modules is not matched against, then we can stop before x/y/z
      const _doesMatchNone = doesMatchNone(dir);

      if (!_doesMatchNone) {
        resultBroadcaster.emit(events.FILENAME_DOES_NOT_MATCH_NONE,
          '\n => You may have wanted to run file with this name:' + dir + ', ' +
          'but it didnt match the regex(es) you passed in as input for "matchNone".');
        return process.nextTick(cb);
      }

      fs.stat(dir, function (err, stats) {
        if (err) {
          return cb(err);
        }

        const countIsGreaterThanMaxDepth = (count > opts.max_depth);
        const isStartingToBeRecursive = (count > 0 && !global.sumanOpts.recursive);

        if (stats.isDirectory() && !countIsGreaterThanMaxDepth && !isStartingToBeRecursive) {
          fs.readdir(dir, function (err, items) {
            if (err) {
              console.error('\n', ' ', colors.bgBlack.yellow(' => Suman presumes you wanted to run tests with/within the ' +
                'following path => '), '\n ', colors.bgBlack.cyan(' => "' + dir + '" '));
              console.error(' ', colors.magenta.bold(' => But this file or directory cannot be found.'));
              console.error('\n', colors.magenta(err.stack || err), '\n\n');
              return cb(err);
            }
            items = items.map(i => path.resolve(dir + '/' + i));
            runDirs(items, ++count, cb);
          });

        }
        else if (stats.isFile() && ACCEPTED_CHILD_FILE_EXTENSIONS.indexOf(path.extname(dir)) > -1) {

          const baseName = path.basename(dir);

          const _doesMatchAny = doesMatchAny(dir);
          const _doesMatchNone = doesMatchNone(dir);
          const _doesMatchAll = doesMatchAll(dir);

          if (!_doesMatchAny) {
            resultBroadcaster.emit(events.FILENAME_DOES_NOT_MATCH_ANY, '\n => You may have wanted to run file with this name:' + dir + ', ' +
              'but it didnt match the regex(es) you passed in as input for "matchAny".');
            return process.nextTick(cb);
          }

          if (!_doesMatchNone) {
            resultBroadcaster.emit(events.FILENAME_DOES_NOT_MATCH_NONE,
              '\n => You may have wanted to run file with this name:' + dir + ', ' +
              'but it didnt match the regex(es) you passed in as input for "matchNone".');
            return process.nextTick(cb);
          }

          if (!_doesMatchAll) {
            resultBroadcaster.emit(events.FILENAME_DOES_NOT_MATCH_ALL,
              '\n => You may have wanted to run file with this name:' + dir + ',' +
              ' but it didnt match the regex(es) you passed in as input for "matchAll"');

            return process.nextTick(cb);
          }

          if (path.extname(baseName) !== '.js') {
            nonJSFile = true;
            resultBroadcaster.emit(events.FILE_IS_NOT_DOT_JS,
              '\n => Warning -> Suman will attempt to execute the following file:\n "' + colors.cyan(dir) + '",\n (which is not a .js file).\n');
          }

          const file = path.resolve(dir);
          if (_.includes(files, file)) {
            console.log(colors.magenta(' => Suman warning => \n => The following filepath was requested to be run more' +
              ' than once, Suman will only run files once per run! =>'), '\n', file, '\n\n');
          }
          else {
            files.push(file);
          }

          process.nextTick(cb);
        }
        else {
          // console.log(' => File may be a link (symlink), currently not supported by Suman => ', colors.magenta(dir));
          const msg = [
            '\n',
            ' => Suman message => You may have wanted to run tests in the following path:',
            colors.cyan(String(dir)),
            '...but it is either a folder or is not a .js (or accepted file type) file, or it\'s a symlink',
            'if you want to run *subfolders* you shoud use the recursive option -r',
            '...be sure to only run files that constitute Suman tests, to enforce this we',
            'recommend a naming convention to use with Suman tests, see: oresoftware.github.io/suman\n\n'
          ].filter(i => i).join('\n');

          resultBroadcaster.emit(events.RUNNER_HIT_DIRECTORY_BUT_NOT_RECURSIVE, msg);
          process.nextTick(cb);
        }


      });

    }, function (err) {
      if (err) {
        console.error('Error =>' + err.stack || err);
      }

      cb(err);
    });


  })(dirs, 0, function (err) {

    if (err) {
      console.error('Error => ' +err.stack || err);
      process.nextTick(function () {
        cb(err);
      });
    }
    else {

      debug(' => FILES => ', files);

      if (opts.transpile && !opts.useBabelRegister) {
        files = files.map(function (item) {
          return sumanUtils.mapToTargetDir(item).targetPath;
        });
      }

      process.nextTick(function () {
        cb(null, {
          files: files,
          nonJSFile: nonJSFile,
          filesThatDidNotMatch: filesThatDidNotMatch
        });
      });
    }
  });

};
