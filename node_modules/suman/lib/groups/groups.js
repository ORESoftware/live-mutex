'use striiiict';

//core
const path = require('path');
const fs = require('fs');

//npm
const async = require('async');
const rimraf = require('rimraf');
const colors = require('colors/safe');
const util = require('util');
const _ = require('lodash');

//project
const useContainer = require('./use-container');
const useSh = require('./use-sh');
const debug = require('suman-debug')('s:groups', {
  force: true
});
const constants = require('../../config/suman-constants');

///////////////////////////////////////////////////////////////////////////////////////

module.exports = function (paths) {

  /// paths is names of groups to run

  const projectRoot = global.projectRoot;
  const groupLogs = path.resolve(global.sumanHelperDirRoot + '/logs/groups');
  const p = path.resolve(global.sumanHelperDirRoot + '/suman.groups.js');

  debug(' => path to suman.groups.js => ', p);

  var isUseContainer = global.sumanOpts.use_container === true ? true : undefined;
  if (global.sumanOpts.no_use_container === true) {
    isUseContainer = false;
  }

  debug(' => Suman debug => isUseContainer', isUseContainer);

  var isAllowReuseImage = global.sumanOpts.allow_reuse_image === true ? true : undefined;
  if (global.sumanOpts.no_allow_reuse_image === true) {
    isAllowReuseImage = false;
  }

  debug(' => Suman debug => isAllowReuseImage', isAllowReuseImage);

  const groupsFn = require(p);
  var originalGroups;
  var groups = originalGroups = groupsFn({
    useContainer: isUseContainer,
    allowReuseImage: isAllowReuseImage
  }).groups;

  if (paths && paths.length > 0) {

    console.log('\n', colors.cyan(' => Suman message => Only the following groups will be run => ' +
      paths.map(p => '\n => "' + p + '"')), '\n');

    groups = groups.filter(function (g) {
      return paths.indexOf(g.name) > -1;
    });

    groups.forEach(function (g) {
      console.log(' => Suman cli will execute group with name => "' + g.name + '"');
    });
  }

  if (groups.length < 1) {
    console.error('\n\n', colors.red.bold(' => Suman usage error => No suman group matched a name passed at the command line.'));
    console.error('\n\n', colors.green.bold(' => Suman message => Available suman group names are =>  \n'
      + originalGroups.map(g => '\n => "' + g.name + '"')), '\n');

    return process.exit(constants.CLI_EXIT_CODES.NO_GROUP_NAME_MATCHED_COMMAND_LINE_INPUT);
  }

  async.series({

      rimraf: function (cb) {
        //TODO: if directory does not exist, handle that error
        rimraf(groupLogs, {}, cb);
      },

      mkdir: function (cb) {
        fs.mkdir(groupLogs, {}, cb);
      }

    },

    function (err) {

      if (err) {
        throw err;
      }

      const concurrency = global.sumanOpts.concurrency || 1;

      console.log('\n', colors.cyan(' => Suman message => Running suman groups with a --concurrency of => ' + concurrency + ' '), '\n');

      async.mapLimit(groups, concurrency, function (item, cb) {

        const strm = fs.createWriteStream(path.resolve(groupLogs + '/' + item.name + '.log'), {end: false});

        strm.on('error', function (err) {
          console.log(' => User test script error, for item => ', util.inspect(item),
            '\n',
            colors.cyan(' Try running the script directly, if the error is not obvious.'),
            '\n',
            ' => Check the logs at <sumanHelpersDir>/logs/groups',
            '\n',
            colors.magenta(err.stack || err));
        });

        strm.write(' => Beginning of run.');
        console.log(colors.bgGreen.black.bold(' => Suman message => Group name => ', item.name));
        // const strm = null;

        if (item.useContainer) {
          console.log('\n', colors.cyan(' => Suman => using container for item => ') + '\n' + colors.blue(util.inspect(item)), '\n');
          useContainer(strm, item, cb);
        }
        else {
          console.log('\n', colors.cyan(' => Suman => running item directly => ') + '\n' + colors.blue(util.inspect(item)), '\n');
          useSh(strm, item, cb);
        }

      }, function (err, results) {

        if (err) {
          console.log(' => Suman groups has errored-out => ', (err.stack || err));
          console.log(' => Suman groups is exiting with code 1');
          process.exit(1);
        }
        else {

          results = _.flattenDeep([results]);

          console.log('\n', colors.cyan(' => suman groups results => \n' +

              results.map(function (r) {
                return '\n' + util.inspect(r);
              })),

            '\n');

          var exitCode = 0;
          results.forEach(function (data) {
            exitCode = Math.max(exitCode, data.code);
          });
          process.exit(exitCode);

        }

      });
    });

};
