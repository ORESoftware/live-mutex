'use striiiiict';


process.on('warning', function (w) {
    console.error('\n', ' => Suman warning => ', w.stack || w, '\n');
});

//core
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const util = require('util');

//npm
const async = require('async');
const colors = require('colors/safe');
const debug = require('suman-debug')('s:utils-transpile');

//project
const sumanUtils = require('./utils');

////////////////////////////////////////////////////////////////////////////////////////////////

const projectRoot = process.env.SUMAN_PROJECT_ROOT;

// note => these values were originally assigned in suman/index.js,
// were then passed to suman server, which then required this file
const testDir = process.env.TEST_DIR;
const testSrcDir = process.env.TEST_SRC_DIR;
const testTargetDir = process.env.TEST_TARGET_DIR;
const testTargetDirLength = String(testTargetDir).split(path.sep).length;


debug(['=> (in suman-utils) => process.env =', process.env]);

////////////////////////////////////////////

const mapToTargetDir = sumanUtils.mapToTargetDir;

////////////////////////////////////////////


function run(paths, opts, cb) {


    const testSrcDirLength = String(testSrcDir).split(path.sep).length;
    const testTargetDirLength = String(testTargetDir).split(path.sep).length;


    var babelExec;

    try {
        babelExec = opts.babelExec || path.resolve(require.resolve('babel-cli'), '..', '..', '.bin/babel');
        fs.lstatSync(babelExec);
    }
    catch (err) {
        console.error(colors.cyan(' => Suman error finding Babel executable => '), colors.red(err.stack || err));
        console.error(colors.red(' => Warning, Suman will attempt to use a globally installed version of Babel.'));
        babelExec = cp.execSync('which babel');
    }


    debug([' => Istanbul executable located here => ', babelExec]);

    assert.equal(testSrcDirLength, testTargetDirLength,
        ' => Suman usage error => "testSrcDir" and "testTargetDir" must be at the same level in your project => \n' +
        'See: http://oresoftware.github.io/suman');

    if (opts.all) {   //TODO: opts.all should just be opts.recursive ??

        debug(['opts.all for transpile is true']);

        try {
            assert(testDir && typeof testDir === 'string');
        }
        catch (err) {
            return cb(new Error('You wanted a transpilation run, but you need to define the testDir ' +
                'property in your suman.conf.js file.' + '\n' + err.stack));
        }

        if (paths.length > 0) {
            console.error(colors.yellow(' => Suman warning => Because the --all option was used,' +
                ' suman will ignore the following arguments passed at the command line:'), '\n', paths);
        }

        //TODO: use rimraf or what not, instead of cp
        cp.exec('rm -rf ' + testTargetDir, function (err, stdout, stderr) {
            if (err || String(stdout).match(/error/i) || String(stderr).match(/error/i)) {
                cb(err || stdout || stderr);
            }
            else {

                const cmd1 = ['cd', projectRoot, '&&', babelExec, testSrcDir, '--out-dir', testTargetDir, '--copy-files'].join(' ');

                if (opts.verbose) {
                    console.log('\n', colors.cyan.bgBlack(' => Babel-cli command will be run:\n'), colors.yellow.bgBlack(cmd1), '\n');
                }

                cp.exec(cmd1, function (err) {
                    if (err || String(stdout).match(/error/i) || String(stderr).match(/error/i)) {
                        cb('You may need to run $ suman --use-babel to install the' +
                            ' necessary babel dependencies in your project so suman can use them => \n' + (err.stack || err) || stdout || stderr);
                    }
                    else {
                        console.log(stdout ? '\n' + stdout : '');
                        console.log(stderr ? '\n' + stderr : '');

                        if (!global.sumanOpts.sparse) {
                            console.log('\t' + colors.bgGreen.white.bold(' => Suman messsage => Your entire "' + testDir + '" directory '));
                            console.log('\t' + colors.bgGreen.white.bold(' was successfully transpiled/copied to the "' + testTargetDir + '" directory. ') + '\n');
                        }

                        setImmediate(function () {
                            cb(null, paths.map(mapToTargetDir));
                        });

                        // const cmd2 = 'cd ' + root + ' && babel ' + testDir + ' --out-dir test-target'
                        // 	+ ' --only ' + dirs[0];
                        //
                        // if (opts.verbose) {
                        // 	console.log('\n', 'Babel-cli command 2:', cmd2, '\n');
                        // }
                        //
                        // cp.exec(cmd2, cb);
                    }

                });

            }

        });
    }
    else {  //opts.all == false


        debug(['opts.all for transpile is false']);


        // here we want two things to be faster:
        // no runner, so we save 100ms
        // transpile and option to only copy only 1 .js file

        // if (dirs.length > 0) {
        // 	return cb(new Error('--optimized option uses the testSrcDir property of your config, ' +
        // 		'but you specified a dir option as an argument.'))
        // }
        //
        // dirs = [testDir];


        debug(['opts.sameDir for transpile is false']);


        try {
            assert(paths.length > 0, colors.bgBlack.yellow(' => Suman error => please pass at least one test file path in your command.'));
        }
        catch (err) {
            return cb(err);
        }


        debug([' => targetDir:', testTargetDir]);
        debug([' => paths before array =>', paths]);
    }


    paths = paths.map(item => {
        return path.resolve(path.isAbsolute(item) ? item : (projectRoot + '/' + item));
    });


    debug([' => paths after array =>', paths]);


    //TODO: should be paths[0], need to build up directories for all paths
    const dirsToBuild = sumanUtils.getArrayOfDirsToBuild(testTargetDir, paths[0]);


    debug([' => dirsToBuild:', dirsToBuild]);


    sumanUtils.buildDirs(dirsToBuild, function (err) {  //make test-target dir in case it doesn't exist

        if (err) {
            cb(err);
        }
        else {


            debug([' => Root of project => ', projectRoot]);
            debug([' => "testTargetDir" => ', testTargetDir]);


            // arbitrarily limit to 5 concurrent "babel processes".
            async.mapLimit(paths, 5, function (item, cb) {

                const fsItemTemp = mapToTargetDir(item);
                const fsItem = fsItemTemp.targetPath;


                debug([' => Item to be transpiled:', item]);
                debug([' => fsItem:', fsItem]);

                fs.stat(item, function (err, stats) {

                    if (err) {
                        return cb(err);
                    }

                    if (stats.isFile()) {

                        var cmd;

                        if (path.extname(item) === '.js' || path.extname(item) === '.jsx') {

                            cmd = ['cd', projectRoot, '&&', babelExec, item, '--out-file', fsItem].join(' ');

                            if (true || opts.verbose) {
                                console.log('\n ' + colors.bgCyan.magenta.bold(' => Test file will be transpiled to => ') + colors.bgCyan.black(fsItem));
                            }
                        }
                        else {
                            cmd = ['cd', projectRoot, '&&', 'cp', item, fsItem].join(' ');
                            console.log('\n ' + colors.bgCyan.magenta.bold(' => Test fixture file will be copied to => ' + fsItem));
                        }
                    }
                    else {

                        cmd = ['cd', projectRoot, '&&', babelExec, item, '--out-dir', fsItem, '--copy-files'].join(' ');
                        // cmd = 'cd ' + projectRoot + ' && ./node_modules/.bin/babel ' + item + ' --out-dir ' + fsItem + ' --copy-files';
                        console.log('\n\n ' + colors.bgMagenta.cyan.bold(' => Directory will be transpiled to => '), '\n',
                            colors.bgWhite.black.bold(' ' + fsItem + ' '));
                    }


                    if (opts.verbose) {
                        console.log('\n', colors.cyan.bgBlack(' => The following "babel-cli" command will be run:\n'),
                            colors.yellow.bgBlack(cmd), '\n');
                    }

                    cp.exec(cmd, function (err, stdout, stderr) {
                        if (err) {
                            [err, stdout, stderr].forEach(function (e) {
                                if (e) {
                                    console.error(typeof e === 'string' ? e : util.inspect(e.stack || e));
                                }
                            });

                            cb(colors.bgRed(' => You probably need to run "$ suman --use-babel" to install the' +
                                ' necessary babel dependencies in your project so suman can use them...'));

                        }
                        else {
                            cb(null, fsItemTemp)
                        }
                    });
                })


            }, cb);
        }

    });

}

}

module.exports = run;
