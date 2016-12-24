#!/usr/bin/env node

///////////////////////////////////////////////////////////////////

debugger;  //leave here forever so users can easily debug with "node --inspect" or "node debug"

///////////////////////////////////////////////////////////////////

/*

 For the reader: Suman uses dashdash to parse command line arguments
 We found dashdash to be a better alternative to existing tools like commander
 => https://github.com/trentm/node-dashdash

 */

const token = process.env.SLACK_TOKEN =
    'xoxp-108881304352-109674909365-118141079700-0f880d6a01ed1b16ffaf56fea280570e';

const logExit = require('./lib/helpers/log-exit');

process.on('exit', function (code) {
    if (process.listenerCount('exit') === 1) {
        logExit(code);
    }
});


if (require.main !== module && process.env.SUMAN_EXTRANEOUS_EXECUTABLE !== 'yes') {
    //prevents users from f*king up by accident and getting in an infinite process-spawn
    //loop that will lock up their entire system
    console.log('Warning: attempted to require Suman index.js but this cannot be.');
    return process.exit(1);
}

console.log(' => Resolved path of Suman executable =>', '"' + __filename + '"');

// var sigintCount = 0;
// TODO: add shutdown hooks for runner too
// process.on('SIGINT', () => {
// 	console.log('Suman got your SIGINT => Press Control-C *twice* to exit.');
// 	sigintCount++;
// 	if (sigintCount > 1) {
// 		process.exit(130);
// 	}
// });

const weAreDebugging = require('./lib/helpers/we-are-debugging');

if (weAreDebugging) {
    console.log(' => Suman is in debug mode (we are debugging).');
    console.log(' => Process PID => ', process.pid);
}

/////////////////////////////////////////////////////////////////

function handleExceptionsAndRejections() {

    if (global.sumanOpts && (global.sumanOpts.ignore_uncaught_exceptions || global.sumanOpts.ignore_unhandled_rejections)) {
        console.error('\n => uncaughtException occurred, but we are ignoring due to the ' +
            '"--ignore-uncaught-exceptions" / "--ignore-unhandled-rejections" flag(s) you passed.');
    }
    else {
        console.error('\n => Use "--ignore-uncaught-exceptions" / "--ignore-unhandled-rejections" to potentially debug further,' +
            'or simply continue in your program.\n\n');
        // process.exit(constants.RUNNER_EXIT_CODES.UNEXPECTED_FATAL_ERROR);
        process.exit(59);
    }
}

process.on('uncaughtException', function (err) {

    if (typeof err !== 'object') {
        err = {stack: typeof err === 'string' ? err : util.inspect(err)}
    }

    if (String(err.stack || err).match(/Cannot find module/i) && global.sumanOpts && global.sumanOpts.transpile) {
        console.log(' => If transpiling, you may need to transpile your entire test directory to the destination directory using the ' +
            '--transpile and --all options together.')
    }

    if (process.listenerCount('uncaughtException') === 1) {
        if (err && !err._alreadyHandledBySuman) {
            err._alreadyHandledBySuman = true;
            console.error('\n\n => Suman "uncaughtException" event occurred =>\n', err.stack, '\n\n');
            handleExceptionsAndRejections();
        }
    }

});

process.on('unhandledRejection', function (err) {

    if (typeof err !== 'object') {
        err = {stack: typeof err === 'string' ? err : util.inspect(err)}
    }

    if (err && !err._alreadyHandledBySuman) {
        err._alreadyHandledBySuman = true;
        console.error('\n\n => Suman "unhandledRejection" event occurred =>\n', (err.stack || err), '\n\n');
        handleExceptionsAndRejections();
    }

});

//core
const fs = require('fs');
const path = require('path');
const os = require('os');
const domain = require('domain');
const cp = require('child_process');
const vm = require('vm');
const assert = require('assert');
const EE = require('events');
const util = require('util');

//npm
const semver = require('semver');
const dashdash = require('dashdash');
const colors = require('colors/safe');
const async = require('async');
const _ = require('lodash');
const debug = require('suman-debug')('s:cli');

//project

const constants = require('./config/suman-constants');
const sumanUtils = require('suman-utils/utils');


////////////////////////////////////////////////////////////////////

debug([' => Suman started with the following command:', process.argv]);
debug([' => $NODE_PATH is as follows:', process.env.NODE_PATH]);

////////////////////////////////////////////////////////////////////

const nodeVersion = process.version;
const oldestSupported = constants.OLDEST_SUPPORTED_NODE_VERSION;

if (semver.lt(nodeVersion, oldestSupported)) {
    console.error(colors.red(' => Suman warning => Suman is not well-tested against Node versions prior to ' +
        oldestSupported + ', your version: ' + nodeVersion));
    throw new Error('Please upgrade to a newer Node.js version.');
}

console.log(' => Node.js version:', nodeVersion);

////////////////////////////////////////////////////////////////////

const pkgJSON = require('./package.json');
const sumanVersion = process.env.SUMAN_GLOBAL_VERSION = pkgJSON.version;
console.log(colors.yellow.italic(' => Suman v' + sumanVersion + ' running...'));

////////////////////////////////////////////////////////////////////

const cwd = process.cwd();

////////////////////////////////////////////////////////////////////

const sumanExecutablePath = global.sumanExecutablePath = process.env.SUMAN_EXECUTABLE_PATH = __filename;
var projectRoot = global.projectRoot = process.env.SUMAN_PROJECT_ROOT = sumanUtils.findProjectRoot(cwd);

const cwdAsRoot = process.argv.indexOf('--cwd-is-root') > -1;

if (!projectRoot) {
    if (!cwdAsRoot) {
        console.log(' => Warning => A NPM/Node.js project root could not be found given your current working directory.');
        console.log(colors.red.bold(' => cwd:', cwd, ' '));
        console.log(colors.bgRed.white.bold(' => Please execute the suman command from within the root of your project.'), '\n\n');
        console.log(colors.bgBlack.green(' => (Perhaps you need to run "npm init" before running "suman --init", ' +
                'which will create a package.json file for you at the root of your project.)') + '\n\n');
        return;
    }
    else {
        projectRoot = global.projectRoot = process.env.SUMAN_PROJECT_ROOT = cwd;
    }
}

////////////////////////////////////////////////////////////////////

const opts = global.sumanOpts = require('./lib/parse-cmd-line-opts/parse-opts');
global.sumanArgs = opts._args;

if (opts.verbose) {
    console.log(' => Suman verbose message => Project root:', projectRoot);
}

////////////////////////////////////////////////////////////////////

if (cwd !== projectRoot) {
    if (!opts.vsparse) {
        console.log(' => Note that your current working directory is not equal to the project root:');
        console.log(' => cwd:', colors.magenta(cwd));
        console.log(' => Project root:', colors.magenta(projectRoot));
    }
}
else {
    if (!opts.sparse) {
        if (cwd === projectRoot) {
            console.log(colors.gray(' => cwd:', cwd));
        }
    }
    if (cwd !== projectRoot) {
        console.log(colors.magenta(' => cwd:', cwd));
    }
}

const viaSuman = global.viaSuman = true;
const resultBroadcaster = global.resultBroadcaster = global.resultBroadcaster || new EE();

/////////////////////////////////////////////////////////////////////

var sumanConfig, pth;

//TODO: use harmony destructuring args later on
const configPath = opts.config;
const serverName = opts.server_name;
const convert = opts.convert;
const src = opts.src;
const dest = opts.dest;
const init = opts.init;
const uninstall = opts.uninstall;
const force = opts.force;
const fforce = opts.fforce;
const s = opts.server;
const tailRunner = opts.tail_runner;
const tailTest = opts.tail_test;
const useBabel = opts.use_babel;
const useServer = opts.use_server;
const tail = opts.tail;
const removeBabel = opts.remove_babel;
const create = opts.create;
const watch = opts.watch;
const useIstanbul = opts.use_istanbul;
const interactive = opts.interactive;
const appendMatchAny = opts.append_match_any;
const appendMatchAll = opts.append_match_all;
const appendMatchNone = opts.append_match_none;
const matchAny = opts.match_any;
const matchAll = opts.match_all;
const matchNone = opts.match_none;
const uninstallBabel = opts.uninstall_babel;
const groups = opts.groups;

//re-assignable
var babelRegister = opts.babel_register;
var noBabelRegister = opts.no_babel_register;
const originalTranspileOption = opts.transpile = !!opts.transpile;

//////////////////////////////////
var sumanInstalledLocally = null;
var sumanInstalledAtAll = null;
var sumanServerInstalled = null;
///////////////////////////////////

if (opts.version) {
    console.log(' => Node.js version:', process.version);
    console.log('...And we\'re done here.', '\n');
    return;
}

//////////////// check for cmd line contradictions ///////////////////////////////////

if (opts.transpile && opts.no_transpile) {
    throw new Error(' \n => Suman fatal problem => --transpile and --no-transpile options were both set,' +
        ' please choose one only.\n');
}

if (opts.append_match_all && opts.match_all) {
    throw new Error(' \n => Suman fatal problem => --match-all and --append-match-all options were both set,' +
        ' please choose one only.\n');
}

if (opts.append_match_any && opts.match_any) {
    throw new Error(' \n => Suman fatal problem => --match-any and --append-match-any options were both set,' +
        ' please choose one only.\n');
}

if (opts.append_match_none && opts.match_none) {
    throw new Error(' \n => Suman fatal problem => --match-none and --append-match-none options were both set,' +
        ' please choose one only.\n');
}


if (opts.watch && opts.stop_watching) {
    console.log('\n', '=> Suman fatal problem => --watch and --stop-watching options were both set, ' +
        'please choose one only.', '\n');
    return;
}

if (opts.babel_register && opts.no_babel_register) {
    console.log('\n', '=> Suman fatal problem => --babel-register and --no-babel-register command line options were both set,' +
        ' please choose one only.', '\n');
    return;
}

////////////////////////////////////////////////////////////////////////////////////


try {
    //TODO: There's a potential bug where the user passes a test path to the config argument like so --cfg path/to/test
    pth = path.resolve(configPath || (cwd + '/' + 'suman.conf.js'));
    sumanConfig = global.sumanConfig = require(pth);
    if (opts.verbose) {  //default to true
        console.log(' => Suman verbose message => Suman config used: ' + pth);
    }

}
catch (err) {

    console.log(colors.bgBlack.yellow(' => Suman warning => Could not find path to your config file in your current working directory or given by --cfg at the command line...'));
    console.log(colors.bgBlack.yellow(' => ...are you sure you issued the suman command in the right directory? ...now looking for a config file at the root of your project...'));

    try {
        pth = path.resolve(projectRoot + '/' + 'suman.conf.js');
        sumanConfig = global.sumanConfig = require(pth);
        if (!opts.sparse) {  //default to true
            console.log(colors.cyan(' => Suman config used: ' + pth + '\n'));
        }
    }
    catch (err) {

        // if (!uninstall) {
        //     if (!String(err.stack || err).match(/Cannot find module\.*suman\.conf\.js/)) {
        //         throw new Error(' => Suman message => Warning - no configuration (suman.conf.js) ' +
        //             'found in the root of your project.\n  ' + (err.stack || err));
        //     }
        //     else {
        //         throw new Error(colors.red(' => Suman usage error => There was an error loading your suman.conf.js file =>')
        //             + '\n ' + (err.stack || err));
        //     }

        global.usingDefaultConfig = true;
        console.log(' => Suman warning => Using default configuration file, please create your suman.conf.js file using suman --init.');

        sumanConfig = global.sumanConfig = require('./lib/default-conf-files/suman.default.conf');

        // }
        // else {
        //     // if we read in the default config, then package.json is not resolved correctly
        //     // we need to provide some default values though
        //     sumanConfig = global.sumanConfig = {
        //         sumanHelpersDir: 'suman'
        //     };
        // }
        // note that we used to use to fallback on default configuration, but now we don't anymore
    }

}

if (init) {
    console.log('\n',colors.magenta(' => "suman --init" is running.'),'\n');
    // TODO: force empty config if --init option given?
    sumanConfig = global.sumanConfig = global.sumanConfig || {};
}
else {

    const installObj = require('./lib/helpers/determine-if-suman-is-installed')(sumanConfig, opts);
    sumanInstalledAtAll = installObj.sumanInstalledAtAll;
    sumanServerInstalled = installObj.sumanServerInstalled;
    sumanInstalledLocally = installObj.sumanInstalledLocally;
}

debug(' => Suman configuration (suman.conf.js) => ', sumanConfig);

const sumanPaths = require('./lib/helpers/resolve-shared-dirs')(sumanConfig, projectRoot);
const sumanObj = require('./lib/helpers/load-shared-objects')(sumanPaths, projectRoot);

/////////////////////////////////////////////////////////////////////////////////////////////////////////

if (sumanConfig.transpile === true && sumanConfig.useBabelRegister === true && opts.verbose) {
    console.log('\n\n', ' => Suman warning => both the "transpile" and "useBabelRegister" properties are set to true in your config.\n' +
        '  The "transpile" option will tell Suman to transpile your sources to the "test-target" directory, whereas', '\n',
        ' "useBabelRegister" will transpile your sources on the fly and no transpiled files will be written to the filesystem.', '\n');

}


///////////////////// HERE WE RECONCILE / MERGE COMMAND LINE OPTS WITH CONFIG ///////////////////////////

if ('concurrency' in opts) {
    assert(Number.isInteger(opts.concurrency) && Number(opts.concurrency) > 0,
        colors.red(' => Suman usage error => "--concurrency" option value should be an integer greater than 0.'));
}

global.maxProcs = opts.concurrency || sumanConfig.maxParallelProcesses || 15;

/////////////////////// matching ///////////////////////////////////////

// if matchAny is passed it overwrites anything in suman.conf.js, same goes for matchAll, matchNone
// however, if appendMatchAny is passed, then it will append to the values in suman.conf.js
const sumanMatchesAny = (matchAny || (sumanConfig.matchAny || []).concat(appendMatchAny || []))
    .map(item => (item instanceof RegExp) ? item : new RegExp(item));

if (sumanMatchesAny.length < 1) {
    // if the user does not provide anything, we default to this
    sumanMatchesAny.push(/\.js$/);
}

//http://stackoverflow.com/questions/1723182/a-regex-that-will-never-be-matched-by-anything
const sumanMatchesNone = (matchNone || (sumanConfig.matchNone || []).concat(appendMatchNone || []))
    .map(item => (item instanceof RegExp) ? item : new RegExp(item));

const sumanMatchesAll = (matchAll || (sumanConfig.matchAll || []).concat(appendMatchAll || []))
    .map(item => (item instanceof RegExp) ? item : new RegExp(item));


global.sumanMatchesAny = _.uniqBy(sumanMatchesAny, item => item);
global.sumanMatchesNone = _.uniqBy(sumanMatchesNone, item => item);
global.sumanMatchesAll = _.uniqBy(sumanMatchesAll, item => item);

/////////// override transpile ///////////


if (opts.no_transpile) {
    opts.transpile = false;
}
else {

    if (sumanConfig.transpile === true) {
        opts.transpile = true;
        if (opts.verbose && !opts.watch) {
            console.log('\n', colors.bgCyan.black.bold('=> Suman message => transpilation is the default due to ' +
                'your configuration option => transpile:true'), '\n');
        }
    }


    debug(' => "babelRegister" opt => ', babelRegister);
    debug(' => "noBabelRegister" opt => ', noBabelRegister);

    const useBabelRegister = opts.transpile && (babelRegister || (!noBabelRegister && sumanConfig.useBabelRegister));

    if (useBabelRegister) {
        opts.useBabelRegister = true;
        process.env.USE_BABEL_REGISTER = 'yes';

        if (!opts.vsparse) {
            if (sumanConfig.transpile === true) {
                console.log('\n ', colors.bgCyan.black.bold(' => the ' + colors.magenta('--babel-register')
                        + ' flag was passed or ' + colors.magenta('useBabelRegister')
                        + ' was set to true in your suman.conf.js file,') + '\n  ' +
                    colors.bgCyan.black.bold(' so we will transpile on the fly with "babel-register",' +
                        ' no transpiled files will be written out.'), '\n');
            }
            else {
                if (babelRegister && opts.verbose) {
                    console.log('\n', colors.bgCyan.black.bold('=> Suman message => ' + colors.magenta('--babel-register')
                            + ' flag passed or useBabelRegister is' +
                            'set to true in your suman.conf.js file, so we will transpile your sources on the fly,') + '\n' +
                        colors.bgCyan.black.bold('no transpiled files will be written out.'), '\n');
                }
                else if (opts.verbose) {
                    console.log('\n', colors.bgCyan.black.bold(' => Suman message => "useBabelRegister" property set to true in your config,' +
                            ' so we will transpile your sources on the fly.') + '\n ' +
                        colors.bgCyan.black.bold(' No transpiled files will be written out. '), '\n');
                }
            }
        }

    }
}

//////////////////// abort if too many top-level options /////////////////////////////////////////////

const preOptCheck = {

    watch: watch,
    create: create,
    useServer: useServer,
    useBabel: useBabel,
    useIstanbul: useIstanbul,
    init: init,
    uninstall: uninstall,
    convert: convert,
    groups: groups,
    s: s,
    tailTest: tailTest,
    tailRunner: tailRunner,
    interactive: interactive,
    uninstallBabel: uninstallBabel
    //TODO: should mix this with uninstall-suman
};

const optCheck = Object.keys(preOptCheck).filter(function (key, index) {

    const value = preOptCheck[key];
    if (value) {
        debug(' => filtering item at index => ', index, ', item => ', value);
    }
    return value;

}).map(function (key) {
    const value = preOptCheck[key];
    const obj = {};
    obj[key] = value;
    return obj;
});

if (optCheck.length > 1) {
    console.error('\t => Too many options, pick one from  { --convert, --init, --server, --use-babel, --uninstall --tail-test, --tail-runner }');
    console.error('\t => Current options used were => ', util.inspect(optCheck));
    console.error('\t => Use --help for more information.\n');
    console.error('\t => Use --examples to see command line examples for using Suman in the intended manner.\n');
    process.exit(constants.EXIT_CODES.BAD_COMMAND_LINE_OPTION);
    return;
}

/////////////////// load reporters  ////////////////////////////////////////////////////

require('./lib/helpers/load-reporters')(opts, projectRoot, sumanConfig, resultBroadcaster);
resultBroadcaster.emit('node-version', nodeVersion);
resultBroadcaster.emit('suman-version', sumanVersion);

//note: whatever args are remaining are assumed to be file or directory paths to tests
const paths = JSON.parse(JSON.stringify(opts._args)).filter(function (item) {
    if (String(item).indexOf('-') === 0) {
        console.log(colors.magenta(' => Suman warning => Extra command line option "' + item + '", Suman is ignoring it.'));
        return false;
    }
    return true;
});

if (opts.verbose) {
    console.log(' => Suman verbose message => arguments assumed to be test file paths to be run:', paths);
    if (paths.length < 1) {
        console.log(' => Suman verbose message => Since no paths were passed at the command line, we \n' +
            'default to running tests from the "testSrc" directory (defined in your suman.conf.js file).');
    }
}


////////// slack message ///////////////

//TODO: also can load any deps that are needed (babel, instanbul, suman-inquirer, etc), here, instead of elsewhere
require('./lib/helpers/slack-integration.js')({optCheck: optCheck}, function () {

    if (interactive) {
        require('./lib/interactive');
    }
    else if (uninstallBabel) {
        require('./lib/use-babel/uninstall-babel')(null);
    }
    else if (useIstanbul) {
        require('./lib/use-istanbul/use-istanbul')();
    }
    else if (tail) {
        require('./lib/make-tail/tail-any')(paths);
    }
    else if (create) {
        require('./lib/create-opt/create')(create);
    }
    else if (useServer) {
        require('./lib/use-server/use-server')(null);
    }
    else if (useBabel) {
        require('./lib/use-babel/use-babel')(null);
    }
    else if (init) {

        require('./lib/init/init-project')({
            force: force,
            fforce: fforce
        });

    }
    else if (uninstall) {
        require('./lib/uninstall/uninstall-suman')({
            force: force,
            fforce: fforce,
            removeBabel: removeBabel,
        });

    }
    else if (convert) {
        require('./lib/helpers/convert-mocha')(projectRoot, src, dest, force);

    }
    else if (s) {
        require('./lib/helpers/start-server')(sumanServerInstalled, sumanConfig, serverName);
    }
    else if (watch) {
        require('./lib/watching/watch-init')(paths, sumanServerInstalled);
    }

    else if (groups) {
        require('./lib/groups/groups.js')(paths);
    }

    else {
        //this path runs all tests
        require('./lib/run')(opts, paths, sumanServerInstalled, sumanVersion);

    }


});

