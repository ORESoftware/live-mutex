/**
 * Created by Olegzandr on 6/13/16.
 */


//core
const cp = require('child_process');
const path = require('path');
const os = require('os');
const url = require('url');

//npm
const async = require('async');

//project
const sumanUtils = require('suman-utils/utils');

/////////////////////////////////////////////////////////

const projRoot = global.projectRoot;
const preTailTarget = path.normalize(path.resolve(__dirname + '/tail-2.sh'));
// const tailTarget = path.normalize(path.resolve(__dirname + '/tail.sh'));

const files = [

  'runner-debug.log',
  'server.log',
  'test-debug.log',
  'watcher-output.log',
  'project-watcher-output.log'

].map(item => {

  return path.resolve(global.sumanHelperDirRoot + '/logs/' + item);

});

var port = 9001;
var timeout = 1000;

function tail (paths) {

  if (paths.length < 1) {
    paths = files;
  }
  else {
    paths = files.filter(f => {
      return !paths.every(p => {
        return !path.basename(f).match(new RegExp(p, 'i'));
      })
    });
  }

  paths.forEach(function (file) {

    var n;

    if (os.platform() === 'win32') {

      //n = cp.spawn('powershell.exe', ['Get-Content','C:\\Users\\denman\\WebstormProjects\\suman-private\\suman\\stdio-logs\\runner-stderr.log','-Wait'], {
      //
      //});
      //n = cp.spawn('start', ['powershell.exe', 'Get-Content', 'C:\\Users\\denman\\WebstormProjects\\suman-private\\suman\\stdio-logs\\runner-stderr.log', '-Wait'], {});

      n = cp.exec('start powershell.exe -NoExit "Get-Content ' + file + ' -Wait"', function (err, stdout, stderr) {

        if (err) {
          console.error(err.stack);
          // process.exit(1);
        }
        else {
          // process.exit(0);
        }

      });

      //const fileToTail = path.resolve(projRoot + '/suman/stdio-logs/runner-stderr.log');
      //n.stdin.write('Get-Content ' + fileToTail + ' -Wait');

      //const file = path.resolve(__dirname + '/start-tailing-windows.bat');
      //n = cp.exec(file, [], {
      //    detached: true,
      //    env: {
      //        NODE_ENV: process.env.NODE_ENV
      //    }
      //});

    }
    else {

      console.log('tailing file => ' + file);

      // n = cp.spawn('sh', [preTailTarget], {
      // 	env: {
      // 		FILE_TO_TAIL: file
      // 	}
      // });

      console.log(' => Suman message => about to tail....');

      const prt = port++;
      const cmd = 'cd ' + projectRoot + ' && ./node_modules/.bin/frontail -d --theme dark -p ' + prt + ' ' + file;

      console.log('Command used => ', cmd);

      cp.exec(cmd, function (err) {
        if (err) {
          console.log(err.stack || err);
        }
        else {
          setTimeout(function () {
            cp.exec('open -a Firefox ' + 'http://localhost' + ':' + prt, function (err) {
              if (err) {
                console.log(err.stack || err);
              }
            });
          }, timeout += 100);

        }
      });

    }
  });

}

module.exports = tail;