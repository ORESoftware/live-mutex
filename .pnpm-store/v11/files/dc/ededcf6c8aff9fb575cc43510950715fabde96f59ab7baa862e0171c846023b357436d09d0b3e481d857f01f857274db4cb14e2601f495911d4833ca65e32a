'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var assert = require("assert");
var path = require("path");
var fs = require("fs");
var logging_1 = require("./logging");
var chalk = require("chalk");
var async = require("async");
var su = require("suman-utils");
exports.getAlwaysIgnore = function () {
    return [
        '.DS_Store',
        '/.idea/',
        '___jb_old___',
        '___jb_tmp___',
        '/node_modules/',
        '/.git/',
        '\\.log$',
        '/logs/',
        '/@target/',
        '\.txt$'
    ];
};
var sig = ['@run.sh', '@transform.sh', '@config.json', 'suman.conf.js'];
exports.isPathMatchesSig = function (basename) {
    return sig.some(function (v) {
        return String(basename) === String(v);
    });
};
exports.getWatchObj = function (projectRoot, sumanOpts, sumanConfig) {
    if (!sumanConfig) {
        var p = path.resolve(projectRoot + '/suman.conf.js');
        logging_1.log.warning("new suman.conf.js path => " + p);
        delete require.cache[p];
        logging_1.log.warning("deleted suman.conf.js cache");
        sumanConfig = require(p);
        logging_1.log.warning("re-required suman.conf.js file.");
    }
    var watchObj = null;
    if (sumanOpts.watch_per) {
        assert(su.isObject(sumanConfig.watch), chalk.red(' => Suman usage error => suman.conf.js needs a "watch" property that is an object.'));
        assert(su.isObject(sumanConfig.watch.per), chalk.red(' => Suman usage error => suman.conf.js "watch" object, needs property called "per" that is an object.'));
        watchObj = sumanConfig.watch.per[sumanOpts.watch_per];
        assert(su.isObject(watchObj), chalk.red("Suman usage error => key \"" + sumanOpts.watch_per + "\" does not exist on the {suman.conf.js}.watch.per object."));
    }
    return {
        watchObj: watchObj,
        sumanConfig: sumanConfig
    };
};
exports.find = function (getTransformPaths, cb) {
    async.map(Object.keys(getTransformPaths), function (key, cb) {
        if (!getTransformPaths[key]['@config.json']) {
            return process.nextTick(cb);
        }
        var p = path.resolve(key + '/@config.json');
        fs.readFile(p, 'utf8', function (err, data) {
            if (err) {
                return cb(err);
            }
            try {
                cb(null, { path: p, data: JSON.parse(data) });
            }
            catch (err) {
                cb(err);
            }
        });
    }, cb);
};
var $exports = module.exports;
exports.default = $exports;
