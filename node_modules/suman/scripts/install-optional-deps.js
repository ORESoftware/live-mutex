//core
const path = require('path');
const cp = require('child_process');
const fs = require('fs');
const assert = require('assert');
const util = require('util');

//npm
const colors = require('colors/safe');
const lockfile = require('lockfile');
const async = require('async');
const semver = require('semver');
const ijson = require('siamese');
const queueWorkerLock = path.resolve(process.env.HOME + '/.suman/queue-worker.lock');
const installQueueLock = path.resolve(process.env.HOME + '/.suman/install-queue.lock');
const queue = path.resolve(process.env.HOME + '/.suman/install-queue.txt');

//project
const sumanUtils = require('suman-utils/utils');
const residence = require('residence');
const queueWorker = require('./queue-worker');

///////////////////////////////////////////////////////////////////////////////////////////

const debug = require('suman-debug')('s:postinstall', {
    fg: 'cyan'
});

///////////////////////////////////////////////////////////////////////////////////////////

const deps = Object.freeze({
    'slack': {
        'slack': 'latest'
    },
    'babel': {
        'webpack': 'latest',
        'babel-cli': 'latest',
        'babel-core': 'latest',
        'babel-loader': 'latest',
        'babel-polyfill': 'latest',
        'babel-runtime': 'latest',
        'babel-register': 'latest',
        'babel-plugin-transform-runtime': 'latest',
        'babel-preset-es2015': 'latest',
        'babel-preset-es2016': 'latest',
        'babel-preset-react': 'latest',
        'babel-preset-stage-0': 'latest',
        'babel-preset-stage-1': 'latest',
        'babel-preset-stage-2': 'latest',
        'babel-preset-stage-3': 'latest',
    },
    'sumanServer': {
        'frontail': 'latest',
        'suman-server': 'latest'
    },
    'sumanInteractive': {
        'suman-inquirer': 'latest',
        'suman-inquirer-directory': 'latest',
    },
    'istanbul': {
        'istanbul': 'latest',
    },
    'nyc': {
        'nyc': 'latest'
    }
});

const bd = process.env.BASE_DIRECTORY;
const dirs = ['HOME', 'USERS'];

//if base directory is not home or users, then we are installing globally, so always install all
//TODO: regarding above, but what about NVM?
const alwaysInstallDueToGlobal = dirs.indexOf(String(bd).trim().toUpperCase().replace(path.sep, '')) < 0;

const cwd = process.cwd();
debug(' => cwd in postinstall script =>', cwd);
const projectRoot = residence.findProjectRoot(cwd);
debug('project root => ', projectRoot);


// semver.gt('1.2.3', '9.8.7') // false

var pkgDotJSON;
const pth = path.resolve(projectRoot + '/package.json');

try {
    pkgDotJSON = require(pth);
}
catch (err) {
    console.error('\n',
        ' => Suman postinstall warning => \n',
        'Could not find package.json located here => ', pth, '\n');
}

var sumanConf = {};
var alwaysInstall = false;

try {
    require(path.resolve(projectRoot + '/suman.conf.js'));
}
catch (err) {
    // if there is not suman.conf.js file, we install all deps, and we do it as a daemon
    alwaysInstall = true;
}


//always install latest for now
var installs = [];

installs = installs.concat(Object.keys(deps.slack));

if (sumanConf.useBabel || alwaysInstall || alwaysInstallDueToGlobal) {
    installs = installs.concat(Object.keys(deps.babel));
}

if (sumanConf.useSumanServer || alwaysInstall || alwaysInstallDueToGlobal) {
    installs = installs.concat(Object.keys(deps.sumanServer));
}

if (sumanConf.useSumanInteractive || alwaysInstall || alwaysInstallDueToGlobal) {
    installs = installs.concat(Object.keys(deps.sumanInteractive));
}

if (sumanConf.useIstanbul || alwaysInstall || alwaysInstallDueToGlobal) {
    installs = installs.concat(Object.keys(deps.istanbul));
}

const sumanHome = path.resolve(process.env.HOME + '/.suman');
const debugLog = path.resolve(sumanHome + '/suman-debug.log');

//200 second timeout...
const to = setTimeout(function () {
    console.error(' => Suman postinstall process timed out.');
    process.exit(1);
}, 2000000);


debug('=> Installs =>', installs);
const fd = fs.openSync(debugLog, 'a');
// const fdstderr =fs.openSync(debugLog, 'a');

const time = Date.now();

const obj = {
    stale: 19000,
    wait: 20000,
    pollPeriod: 110,
    retries: 300,
    retryWait: 150
};



async.map(installs, function (item, cb) {

    const p = path.resolve(sumanHome + '/node_modules/', item);

    async.parallel({
        view: function (cb) {
            cp.exec('npm view ' + item + ' version', function (err, val) {
                if (err) {
                    return cb(err);
                }
                cb(null, {
                    name: item,
                    version: String(val).replace(/\s/g, '')
                })
            });
        },
        stats: function (cb) {

            const pkg = path.resolve(p + '/package.json');

            fs.readFile(pkg, 'utf8', function (err, data) {
                if (err) {
                    cb(null, {version: null});
                }
                else {
                    ijson.parse(data).then(function (val) {
                        if (!val || !val.version) {
                            console.error(' val is not defined for item => ', item);
                        }
                        cb(null, {
                            version: val && val.version
                        })
                    }, cb);

                }

            })

        }
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        debug([' item => ' + item, 'view version:'
        + results.view.version, 'stats version:' + results.stats.version].join(', '));

        if (!results.stats.version) {
            results.view.action = 'install';
        }
        else {
            // semver.gt('1.2.3', '9.8.7') // false

            try {
                assert(semver.valid(results.stats.version));
                assert(semver.valid(results.view.version));

            }
            catch (err) {
                console.error(err.stack || err);
                results.view.action = 'install';
                return cb(null, results.view);
            }

            if (semver.lt(results.stats.version, results.view.version)) {
                results.view.action = 'update';
            }
            else {
                results.view.action = 'do-nothing';
            }
        }
        //finally we call
        cb(null, results.view);
    });


}, function (err, results) {

    if (err) {
        console.error(err);
        return process.exit(1);
    }

    var runWorker = false;

    async.eachSeries(results, function (result, cb) {

        debug(' result => ', util.inspect(result));
        const item = result.name;
        const action = result.action;

        var args;

        switch (action) {
            case 'do-nothing':
                // local version is up-to-date with latest in npm registry
                return process.nextTick(cb);
            case 'install':
                console.log(' => Installing => ', item, ' at path => ', sumanHome);
                args = ['npm', 'install', item + '@latest', '--force', '--loglevel=error', '--silent', '--progress=false'];
                break;
            case 'update':
                console.log(' => Updating => ', item, ' at path => ', sumanHome);
                args = ['npm', 'update', item + '@latest', '--loglevel=error', '--silent', '--progress=false'];
                break;
            default:
                return process.nextTick(function () {
                    cb(new Error(' => Switch statement fallthrough.'));
                });
        }

        args = args.join(' ').trim();
        runWorker = true;

        lockfile.lock(installQueueLock, obj, function (err) {

            if (err) {
                return cb(err);
            }

            fs.readFile(queue, 'utf8', function (err, data) {
                if (err) {
                    lockfile.unlock(installQueueLock, function () {
                        cb(err);
                    });
                }
                else {
                    const lines = String(data).split('\n');
                    lines.push(args);
                    fs.writeFile(queue, lines.join('\n'), function ($err) {
                        lockfile.unlock(installQueueLock, function (err) {
                            cb($err || err);
                        });
                    });

                }
            });

        });


        // const n = cp.spawn('npm', args, {
        //     cwd: sumanHome,
        //     stdio: ['ignore', fd, fd]
        // });
        //
        // n.on('close', cb);

    }, function (err) {

        if (err) {
            console.error(err.stack || err);
            return process.exit(1);
        }

        /*

         opts.wait
         A number of milliseconds to wait for locks to expire before giving up.
         Only used by lockFile.lock. Poll for opts.wait ms. If the lock is not cleared by the time the wait expires,
         then it returns with the original error.

         opts.pollPeriod
         When using opts.wait, this is the period in ms in which it polls to check if the lock has expired.
         Defaults to 100.

         opts.stale
         A number of milliseconds before locks are considered to have expired.

         opts.retries
         Used by lock and lockSync. Retry n number of times before giving up.

         opts.retryWait
         Used by lock. Wait n milliseconds before retrying.

         */

        if (!runWorker) {
            return process.exit(0);
        }

        function makeWorker() {
            queueWorker(function () {
                console.log(' => Done with queue-worker, now unlocking queueWorkerLock...');
                fs.unlink(queueWorkerLock, function () {
                    clearTimeout(to);
                    console.log(' => Total suman postinstall optional deps time => ', String(Date.now() - time));
                    process.exit(0);
                });
            });
        }


        fs.writeFile(queueWorkerLock, String(new Date()), {flag: 'wx', flags: 'wx'}, function (err) {

            if (err && !String(err.stack || err).match(/EEXIST/i)) {
                //if error does not match EEXIST, then it's an error we consider actually problematic
                console.error(err.stack || err);
                return process.exit(1);
            }
            else if (err) {
                // file already EXISTS, so let's see if it's stale being reading the date in it
                fs.readFile(queueWorkerLock, function (err, data) {
                    //ignore err
                    if (err) {
                        console.error(err.stack || err);
                    }
                    if (data) {
                        const now = new Date();
                        const then = new Date(String(data).trim());
                        console.log(colors.green.bold(' => Existing date in lock file => '), colors.yellow.bold(then));
                        if (now - then > 300000) {
                            console.log(' => Lock is old, we will unlink at start processing queue.');
                            fs.unlink(queueWorkerLock, makeWorker);
                        }
                        else{
                            console.log(' => Lock is still young, we will let the current worker do its thing.');
                            process.exit(0);
                        }
                    }
                    else {
                        console.error(new Error(' => No data returned from readFile call to queueWorkerLock file.'));
                        return process.exit(1);
                    }
                });

            }
            else {
                makeWorker();
            }

        });

        // lockfile.lock(queueWorkerLock, {
        //
        //     wait: 10000,
        //     stale: 500000,
        //     retries: 40000,
        //     retryWait: 100
        //
        // }, function (err) {
        //
        //     if (err) {
        //         console.error(err.stack || err);
        //         return process.exit(1);
        //     }
        //     else {
        //         queueWorker(function () {
        //             console.log(' => Done with queue-worker, now unlocking queueWorkerLock...');
        //             lockfile.unlock(queueWorkerLock, function () {
        //                 clearTimeout(to);
        //                 console.log(' => Total suman postinstall optional deps time => ', String(Date.now() - time));
        //                 process.exit(0);
        //             });
        //
        //         });
        //     }
        //
        // });

    });


});

