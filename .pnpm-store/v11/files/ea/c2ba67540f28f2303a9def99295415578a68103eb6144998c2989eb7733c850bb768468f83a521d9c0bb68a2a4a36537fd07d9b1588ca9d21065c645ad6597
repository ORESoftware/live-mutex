'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const flattenDeep = require('lodash.flattendeep');
const _suman = global.__suman = (global.__suman || {});
const oncePost = require("../once-post");
let oncePostInvoked = false;
exports.oncePostFn = function (cb) {
    if (!oncePostInvoked) {
        oncePostInvoked = true;
        oncePost.run(function (err, results) {
            err && _suman.log.error(err.stack || err);
            if (Array.isArray(results)) {
                results.filter(r => r).forEach(function (r) {
                    _suman.log.error(r.stack || r);
                });
            }
            else if (results) {
                _suman.log.error('Suman implemenation warning: results is not an array:');
                _suman.log.error(util.inspect(results));
            }
            process.nextTick(cb);
        });
    }
    else {
        _suman.log.error(new Error(`Suman implementation warning => "${exports.oncePostFn.name}" was called more than once.`).stack);
        process.nextTick(cb);
    }
};
