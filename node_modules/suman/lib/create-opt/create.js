/**
 * Created by t_millal on 10/5/16.
 */


//core
const cp = require('child_process');
const path = require('path');
const os = require('os');
const url = require('url');
const fs = require('fs');

//npm
const colors = require('colors/safe');
const async = require('async');
const sumanUtils = require('suman-utils/utils');

//project
const projectRoot = global.projectRoot || sumanUtils.findProjectRoot(process.cwd());


module.exports = function createTestFiles(paths) {

    const p = path.resolve(__dirname, '..', 'default-conf-files/suman.skeleton.js');

    const strm = fs.createReadStream(p);

    async.each(paths, function (p, cb) {
        //TODO: difference between "finish" and "close" events on stream ??
        strm.pipe(fs.createWriteStream(p, {flags: 'wx'})).once('error', cb).once('finish', function(){
            console.log(' => File was created:', p);
            process.nextTick(cb);
        });

    }, function (err) {
        if (err) {
            console.error('\n', colors.red.bold(' => Suman usage error => ') + colors.red(err.stack || err),'\n');
            process.exit(1);
        }
        else {
            console.log('\n',colors.green.bold(' => Suman message => successfully created test skeletons.'),'\n');
            process.exit(0);
        }
    });


};
