'use striiiict';

//core
const path = require('path');
const cp = require('child_process');
const fs = require('fs');

//npm
const colors = require('colors/safe');
const async = require('async');

//project
const debug = require('suman-debug')('s:groups');

////////////////////////////////////////////////////////////////////////////

module.exports = function useContainer(strm, item, cb) {

  //TODO: maybe container does not need to be re-built
  debug(' => Processing the following item => ', item);

  async.waterfall([

    function getExistingImage(cb) {

      var first = true;

      function race() {
        if (first) {
          first = false;
          cb.apply(null, arguments);
        }

      }

      setTimeout(function () {

        race(null, {
          name: item.name,
          isContainerAlreadyBuilt: null,
          containerInfo: null
        });

      }, 3000);

      if (!item.allowReuseImage) {
        process.nextTick(function () {
          race(null, {
            name: item.name,
            isContainerAlreadyBuilt: null,
            containerInfo: null
          });
        });
      }
      else {

        var n = cp.spawn('bash', [], {
          cwd: item.cwd || process.cwd()
        });

        n.stdin.setEncoding('utf8');
        n.stderr.setEncoding('utf8');
        n.stdout.setEncoding('utf8');

        // <<< key part, you must use newline char
        n.stdin.write('\n' + 'docker images -q ' + item.name + '  2> /dev/null' + '\n');

        process.nextTick(function () {
          n.stdin.end();
        });

        var data = '';

        n.stdout.on('data', function (d) {
          data += String(d);
        });

        if (!global.sumanOpts.no_stream_to_console) {
          n.stdout.pipe(process.stdout, {end: false});
          n.stderr.pipe(process.stderr, {end: false});
        }

        if (!global.sumanOpts.no_stream_to_file) {
          n.stdout.pipe(strm, {end: false});
          n.stderr.pipe(strm, {end: false});
        }

        n.on('close', function (code) {
          console.log('EXIT CODE FOR FINDING EXISTING CONTAINER => ', code);
          race(null, {
            name: item.name,
            isContainerAlreadyBuilt: !!data,
            containerInfo: data
          });
        });

      }

    },

    function buildContainer(data, cb) {

      debug(' => data from check existing container => ', item);

      var name = data.name;

      if (data.isContainerAlreadyBuilt) {
        // this means our image has already been built
        debug(' => Container is already built => ', data);
        process.nextTick(function () {
          cb(null, {
            name: name,
            code: 0
          });
        });
      }
      else {

        debug(' => Container is *not* already built....building...');
        const b = item.build();

        debug(' => "Build" container command => ', '"' + b + '"');
        //TODO: need to check if bash is the right interpreter
        var n = cp.spawn('bash', [], {
          cwd: item.cwd || process.cwd()
        });

        n.stdin.setEncoding('utf8');
        n.stderr.setEncoding('utf8');
        n.stdout.setEncoding('utf8');

        n.stdin.write('\n' + b + '\n');   // <<< key part, you must use newline char

        process.nextTick(function () {
          n.stdin.end();
        });

        if (!global.sumanOpts.no_stream_to_console) {
          n.stdout.pipe(process.stdout, {end: false});
          n.stderr.pipe(process.stderr, {end: false});
        }

        if (!global.sumanOpts.no_stream_to_file) {
          n.stdout.pipe(strm, {end: false});
          n.stderr.pipe(strm, {end: false});
        }

        n.on('close', function (code) {
          console.log('EXIT CODE OF CONTAINER BUILD => ', code);
          cb(null, {
            name: name,
            code: code
          });
        });

      }
    },

    function runContainer(data, cb) {

      var code = data.code;
      var name = data.name;

      if (code > 0) {
        console.error('\n', colors.red.bold(' => Exit code of container build command was greater than zero, ' +
          'so we are not running the container.'), '\n');
        return process.nextTick(function () {
          cb(null, {
            code: code,
            name: name
          });
        });
      }

      const r = item.run();
      debug(' => Run container command ', '"' + r + '"');

      var n = cp.spawn('bash', [], {
        cwd: item.cwd || process.cwd()
      });

      n.stdin.setEncoding('utf8');
      n.stdout.setEncoding('utf8');
      n.stderr.setEncoding('utf8');


      n.stdin.write('\n' + r + '\n');   // <<< key part, you must use newline char

      process.nextTick(function () {
        n.stdin.end();
      });

      if (!global.sumanOpts.no_stream_to_console) {
        n.stdout.pipe(process.stdout, {end: false});
        n.stderr.pipe(process.stderr, {end: false});
      }

      if (!global.sumanOpts.no_stream_to_file) {
        n.stdout.pipe(strm, {end: false});
        n.stderr.pipe(strm, {end: false});
      }

      n.on('close', function (code) {
        console.log('EXIT CODE OF CONTAINER RUN => ', code);
        cb(null, {
          code: code,
          name: name
        });
      });
    }

  ], cb);

};
