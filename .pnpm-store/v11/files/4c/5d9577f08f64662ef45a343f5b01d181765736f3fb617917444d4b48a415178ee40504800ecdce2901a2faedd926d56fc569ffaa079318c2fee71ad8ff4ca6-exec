'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
process.on('warning', function (w) {
    console.error('\n', ' => Suman warning => ', (w.stack || w), '\n');
});
var fs = require("fs");
var path = require("path");
var util = require("util");
var assert = require("assert");
var events = require("events");
var async = require("async");
var residence = require('residence');
var mkdirp = require('mkdirp');
var _suman = global.__suman = (global.__suman || {});
var isX = require('./is-x');
var toStr = Object.prototype.toString;
var fnToStr = Function.prototype.toString;
var isFnRegex = /^\s*(?:function)?\*/;
var we_are_debugging_1 = require("./we-are-debugging");
var EventEmitter = events.EventEmitter;
var globalProjectRoot;
exports.weAreDebugging = we_are_debugging_1.default.weAreDebugging;
exports.isStream = isX.isStream;
exports.isObservable = isX.isObservable;
exports.isSubscriber = isX.isSubscriber;
exports.noop = function () { };
exports.newLine = '\n';
exports.isEventEmitter = function (val) {
    return val && ((val instanceof EventEmitter) ||
        (typeof val.once === 'function' && typeof val.on === 'function'
            && typeof val.removeListener === 'function' && typeof val.removeAllListeners === 'function'));
};
exports.vgt = function (val) {
    return _suman.sumanOpts && _suman.sumanOpts.verbosity > val;
};
exports.vlt = function (val) {
    return _suman.sumanOpts && _suman.sumanOpts.verbosity < val;
};
exports.checkStatsIsFile = function (item) {
    try {
        return fs.statSync(item).isFile();
    }
    catch (err) {
        if (exports.vgt(2)) {
            console.error(' => Suman verbose warning => ', err.stack);
        }
        return null;
    }
};
exports.mapToTargetDir = function (item) {
    var projectRoot = process.env.SUMAN_PROJECT_ROOT;
    var testDir = process.env.TEST_DIR;
    var testSrcDir = process.env.TEST_SRC_DIR;
    var testTargetDir = process.env.TEST_TARGET_DIR;
    var testTargetDirLength = String(testTargetDir).split(path.sep).length;
    item = path.resolve(path.isAbsolute(item) ? item : (projectRoot + '/' + item));
    var itemSplit = String(item).split(path.sep);
    itemSplit = itemSplit.filter(function (i) { return i; });
    var originalLength = itemSplit.length;
    var paths = exports.removeSharedRootPath([projectRoot, item]);
    var temp = paths[1][1];
    var splitted = temp.split(path.sep);
    splitted = splitted.filter(function (i) { return i; });
    while ((splitted.length + testTargetDirLength) > originalLength + 1) {
        splitted.shift();
    }
    var joined = splitted.join(path.sep);
    return {
        originalPath: item,
        targetPath: path.resolve(testTargetDir + '/' + joined)
    };
};
exports.findApplicablePathsGivenTransform = function (sumanConfig, transformPath, cb) {
    var dir = path.dirname(transformPath);
    var results = [];
    var firstPass = true;
    (function searchDir(dir, cb) {
        fs.readdir(dir, function (err, items) {
            if (firstPass === false) {
                for (var i = 0; i < items.length; i++) {
                    if (String(items[i]).match(/@transform.sh/)) {
                        return process.nextTick(cb);
                    }
                }
            }
            firstPass = false;
            async.eachLimit(items, 3, function (item, cb) {
                var fullPath = path.resolve(dir + '/' + item);
                fs.stat(fullPath, function (err, stats) {
                    if (err) {
                        console.error(err.stack);
                        return cb();
                    }
                    if (stats.isFile()) {
                        if (String(fullPath).match(/\/@src\//)) {
                            results.push(fullPath);
                        }
                        return cb();
                    }
                    if (stats.isDirectory()) {
                        if (String(fullPath).match(/\/node_modules\//)) {
                            return cb();
                        }
                        searchDir(fullPath, cb);
                    }
                });
            }, cb);
        });
    })(dir, function (err) {
        cb(err, results);
    });
};
exports.isSumanSingleProcess = function () {
    return process.env.SUMAN_SINGLE_PROCESS === 'yes';
};
exports.isSumanDebug = function (cb) {
    var isDebug = process.env.SUMAN_DEBUG === 'yes';
    isDebug && cb && cb();
    return isDebug;
};
exports.runAssertionToCheckForSerialization = function (val) {
    if (!val) {
        return;
    }
    assert(['string', 'boolean', 'number'].indexOf(typeof val) >= 0, ' => Suman usage error => You must serialize data called back from suman.once.pre.js value functions, ' +
        'here is the data in raw form =>\n' + val + ' and here we have run util.inspect on it =>\n' + util.inspect(val));
};
exports.buildDirsWithMkDirp = function (paths, cb) {
    async.each(paths, mkdirp, cb);
};
exports.getArrayOfDirsToBuild = function (testTargetPath, p) {
    var temp;
    var l = path.normalize('/' + testTargetPath).split('/').length;
    var items = path.normalize('/' + p).split('/');
    if (fs.statSync(p).isFile()) {
        items.pop();
    }
    if (items.length >= l) {
        temp = path.normalize(items.slice(l).join('/'));
    }
    else {
        console.log('\n');
        console.error(' => Suman-Utils warning => path to file was not longer than path to test-target dir.');
        console.error(' => Suman-Utils warning => path to file =>', p);
        console.error(' => Suman-Utils warning => testTargetDir =>', testTargetPath);
        console.log('\n');
    }
    if (temp) {
        return path.resolve(testTargetPath + '/' + temp);
    }
    else {
        return undefined;
    }
};
exports.checkIfPathAlreadyExistsInList = function (paths, p, index) {
    return paths.some(function (pth, i) {
        if (i === index) {
            return false;
        }
        return String(pth).indexOf(p) === 0;
    });
};
exports.buildDirs = function (dirs, cb) {
    if (dirs.length < 1) {
        return process.nextTick(cb);
    }
    async.eachSeries(dirs, function (item, cb) {
        fs.mkdir(item, function (err) {
            if (err && !String(err.stack).match(/eexist/i)) {
                console.error(err.stack || err);
                cb(err);
            }
            else {
                cb(null);
            }
        });
    }, cb);
};
exports.padWithFourSpaces = function () {
    return new Array(5).join(' ');
};
exports.padWithXSpaces = function (x) {
    return new Array(x + 1).join(' ');
};
exports.removePath = function (p1, p2) {
    assert(path.isAbsolute(p1) && path.isAbsolute(p2), 'Please pass in absolute paths, ' +
        'p1 => ' + util.inspect(p1) + ', p2 => ' + util.inspect(p2));
    var split1 = String(p1).split(path.sep);
    var split2 = String(p2).split(path.sep);
    var newPath = [];
    var max = Math.max(split1.length, split2.length);
    for (var i = 0; i < max; i++) {
        if (split1[i] !== split2[i]) {
            newPath.push(split1[i]);
        }
    }
    return newPath.join(path.sep);
};
exports.findSharedPath = function (p1, p2) {
    var split1 = String(p1).split(path.sep);
    var split2 = String(p2).split(path.sep);
    var one = split1.filter(function (i) { return i; });
    var two = split2.filter(function (i) { return i; });
    var max = Math.max(one.length, two.length);
    var i = 0;
    var shared = [];
    while (one[i] === two[i] && i < max) {
        shared.push(one[i]);
        i++;
        if (i > 100) {
            throw new Error(' => Suman implementation error => first array => ' + one + ', ' +
                'second array => ' + two);
        }
    }
    shared = shared.filter(function (i) { return i; });
    return path.resolve(path.sep + shared.join(path.sep));
};
exports.removeProjectRootFromPath = function (p) {
    var projectRootLn = _suman.projectRoot.length;
    return p.slice(projectRootLn);
};
exports.removeSharedRootPath = function (paths) {
    if (paths.length < 2) {
        return paths.map(function (p) {
            return [p, path.basename(p), exports.removeProjectRootFromPath(p)];
        });
    }
    var shared;
    paths.forEach(function (p) {
        p = path.normalize(p);
        if (shared) {
            var arr = String(p).split('');
            var i_1 = 0;
            arr.every(function (item, index) {
                if (String(item) !== String(shared[index])) {
                    i_1 = index;
                    return false;
                }
                return true;
            });
            shared = shared.slice(0, i_1);
        }
        else {
            shared = String(p).split('');
        }
    });
    return paths.map(function (p) {
        var basenameLngth = path.basename(p).length;
        return [
            p,
            p.substring(Math.min(shared.length, (p.length - basenameLngth)), p.length),
            exports.removeProjectRootFromPath(p)
        ];
    });
};
exports.checkForValInStr = function (str, regex, count) {
    return ((String(str).match(regex) || []).length > (count === 0 ? 0 : (count || 1)));
};
exports.isGeneratorFn2 = function (fn) {
    var str = String(fn);
    var indexOfFirstParen = str.indexOf('(');
    var indexOfFirstStar = str.indexOf('*');
    return indexOfFirstStar < indexOfFirstParen;
};
exports.isGeneratorFn = function (fn) {
    if (typeof fn !== 'function') {
        return false;
    }
    var fnStr = toStr.call(fn);
    return ((fnStr === '[object Function]' || fnStr === '[object GeneratorFunction]') && isFnRegex.test(fnToStr.call(fn))
        || (fn.constructor.name === 'GeneratorFunction' || fn.constructor.displayName === 'GeneratorFunction'));
};
exports.isArrowFunction = function (fn) {
    return fn && String(fn).trim().indexOf('function') !== 0;
};
exports.isAsyncFn = function (fn) {
    return fn && String(fn).trim().indexOf('async ') === 0;
};
exports.defaultSumanHomeDir = function () {
    return path.normalize(path.resolve((process.env.HOME || process.env.USERPROFILE) + path.sep + 'suman_data'));
};
exports.defaultSumanResultsDir = function () {
    return path.normalize(path.resolve(exports.getHomeDir() + path.sep + 'suman' + path.sep + 'test_results'));
};
exports.getHomeDir = function () {
    return process.env[(process.platform === 'win32' ? 'USERPROFILE' : 'HOME')];
};
exports.findProjectRoot = function (p) {
    if (!globalProjectRoot) {
        globalProjectRoot = residence.findProjectRoot(p);
    }
    return globalProjectRoot;
};
exports.findProjRoot = exports.findProjectRoot;
exports.once = function (ctx, fn) {
    var callable = true;
    return function callOnce(err) {
        if (callable) {
            callable = false;
            return fn.apply(ctx, arguments);
        }
        else {
            _suman.logWarning('suman implementation warning => function was called more than once => ' + fn ? fn.toString() : '');
            if (err) {
                _suman.logError('warning => ', err.stack || util.inspect(err));
            }
        }
    };
};
exports.onceTO = function (ctx, fn, to) {
    var callable = true;
    return function callOnce(err) {
        if (callable) {
            callable = false;
            clearTimeout(to);
            return fn.apply(ctx, arguments);
        }
        else {
            _suman.logWarning('suman implementation warning => function was called more than once => ' + fn ? fn.toString() : '');
            err && _suman.logError('warning => ', err.stack || util.inspect(err));
        }
    };
};
exports.getCleanErrorString = function (e) {
    if (!e) {
        return String(new Error('falsy value passed to error string extractor.').stack);
    }
    else if (typeof (e.stack || e) === 'string') {
        return e.stack || e;
    }
    else {
        return util.inspect(e.stack || e);
    }
};
exports.getCleanErrStr = exports.getCleanErrorString;
exports.xNewLines = function (count) {
    return new Array(count + 1).join('\n');
};
exports.isArrayOrFunction = function (o) {
    return Array.isArray(o) || typeof o === 'function';
};
exports.decomposeError = function (err) {
    if (!err) {
        return new Error('error was null or undefined').stack;
    }
    if (typeof err.stack === 'string') {
        return err.stack;
    }
    return typeof err === 'string' ? err : util.inspect(err);
};
exports.repeatCharXTimes = function (char, num) {
    if (String(char).length < 1) {
        throw new Error('string must be at least 1 character in length.');
    }
    return new Array(num).join(char);
};
exports.createCleanStack = function (str, $ignore) {
    var ignore = ($ignore || [/node_modules/, /next_tick.js/, /sumanjs/]).map(function (r) {
        return r instanceof RegExp ? r : new RegExp(r);
    });
    return String(str).split('\n').filter(function (s) {
        if (/\/sumanjs\/test\//.test(s)) {
            return true;
        }
        return !ignore.some(function (ig) {
            return ig.test(s);
        });
    });
};
exports.onceAsync = function (ctx, fn) {
    var callable = true;
    return function callOnce(err) {
        var args = Array.from(arguments);
        if (callable) {
            callable = false;
            process.nextTick(function () {
                fn.apply(ctx, args);
            });
        }
        else {
            console.log(' => Suman warning => function was called more than once -' + fn ? fn.toString() : '');
            if (err) {
                console.error(' => Suman warning => \n', err.stack || util.inspect(err));
            }
        }
    };
};
exports.customStringify = function (v) {
    var cache = [];
    return JSON.stringify(v, function (key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                return;
            }
            cache.push(value);
        }
        return value;
    });
};
exports.makePathExecutable = function (runPath, cb) {
    if (runPath) {
        fs.chmod(runPath, 511, cb);
    }
    else {
        process.nextTick(cb);
    }
};
exports.checkForEquality = function (arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    arr1 = arr1.sort();
    arr2 = arr2.sort();
    for (var i = 0; i < arr1.length; i++) {
        if (String(arr1[i]) !== String(arr2[i])) {
            return false;
        }
    }
    return true;
};
exports.arrayHasDuplicates = function (a) {
    return !a.every(function (item, i) {
        return a.indexOf(item) === i;
    });
};
exports.isStringWithPositiveLn = function (s) {
    return typeof s === 'string' && s.length > 0;
};
exports.findNearestRunAndTransform = function (root, pth, cb) {
    try {
        if (!fs.statSync(pth).isDirectory()) {
            pth = path.dirname(pth);
        }
    }
    catch (err) {
        return process.nextTick(cb, err);
    }
    var results = [];
    var upPath = pth;
    async.whilst(function () {
        return upPath.length >= root.length;
    }, function (cb) {
        async.parallel({
            run: function (cb) {
                var p = path.resolve(upPath + '/@run.sh');
                fs.stat(p, function (err, stats) {
                    var z = (stats && stats.isFile()) ? { run: p } : undefined;
                    z && results.unshift(z);
                    cb();
                });
            },
            transform: function (cb) {
                var p = path.resolve(upPath + '/@transform.sh');
                fs.stat(p, function (err, stats) {
                    var z = (stats && stats.isFile()) ? { transform: p } : undefined;
                    z && results.unshift(z);
                    cb();
                });
            },
            config: function (cb) {
                var p = path.resolve(upPath + '/@config.json');
                fs.stat(p, function (err, stats) {
                    var z = (stats && stats.isFile()) ? { config: p } : undefined;
                    z && results.unshift(z);
                    cb();
                });
            }
        }, function (err) {
            upPath = path.resolve(upPath + '/../');
            cb(err);
        });
    }, function (err) {
        if (err) {
            return cb(err);
        }
        var ret = results.reduce(function (prev, curr) {
            return (curr ? Object.assign(prev, curr) : prev);
        }, {});
        cb(null, ret);
    });
};
exports.findSumanMarkers = function (types, root, files, cb) {
    var sumanHelpersDirRegex = new RegExp(_suman.sumanHelperDirRoot);
    var map = {};
    var addItem = function (item) {
        var filename = path.basename(item);
        types.forEach(function (t) {
            if (filename === t) {
                if (!map[path.dirname(item)]) {
                    map[path.dirname(item)] = {};
                }
                map[path.dirname(item)][t] = true;
            }
        });
    };
    (function getMarkers(dir, cb) {
        if (sumanHelpersDirRegex.test(dir)) {
            return process.nextTick(cb);
        }
        fs.readdir(dir, function (err, items) {
            if (err) {
                console.error(' => [suman internal] => possibly a symlink => ', dir, '\n');
                return cb(err);
            }
            items = items.map(function (item) {
                return path.resolve(dir, item);
            });
            async.eachLimit(items, 5, function (item, cb) {
                if (sumanHelpersDirRegex.test(item)) {
                    return process.nextTick(cb);
                }
                fs.stat(item, function (err, stats) {
                    if (err) {
                        console.error(' => [suman internal] => possibly a symlink => ', item, '\n');
                        return cb();
                    }
                    if (stats.isFile()) {
                        addItem(item);
                        cb();
                    }
                    else if (stats.isDirectory()) {
                        if (!/node_modules/.test(String(item)) && !/\/.git\//.test(String(item))) {
                            addItem(item);
                            getMarkers(item, cb);
                        }
                        else {
                            console.log(' => Warning => node_modules/.git path ignored => ', item);
                            cb();
                        }
                    }
                    else {
                        console.log(' => Not directory or file => ', item);
                        cb();
                    }
                });
            }, cb);
        });
    })(root, function (err) {
        err ? cb(err) : cb(null, map);
    });
};
exports.isObject = function (v) {
    return v && typeof v === 'object' && !Array.isArray(v);
};
var $exports = module.exports;
exports.default = $exports;
