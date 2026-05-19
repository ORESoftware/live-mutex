'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const fs = require("fs");
const path = require("path");
const async = require("async");
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
exports.run = function (opts) {
    const { projectRoot } = _suman;
    const testSrcDir = process.env.TEST_SRC_DIR;
    async.autoInject({
        chmod: function (cb) {
            const filesToFind = ['@run.sh', '@transform.sh', '@target', '@src'];
            su.findSumanMarkers(filesToFind, testSrcDir, [], function (err, map) {
                const keys = Object.keys(map);
                async.eachLimit(keys, 5, function (k, cb) {
                    let keys = Object.keys(map[k]);
                    async.each(keys, function (key, cb) {
                        let fileOrFolder = path.join(k, key);
                        _suman.log.info('Running 777 against this file/folder:', fileOrFolder);
                        fs.chmod(fileOrFolder, '511', cb);
                    }, cb);
                }, cb);
            });
        },
        postinstall: function (cb) {
            process.nextTick(cb);
        }
    }, function (err, results) {
        if (err) {
            throw err;
        }
        _suman.log.info('Results => ', results);
    });
};
