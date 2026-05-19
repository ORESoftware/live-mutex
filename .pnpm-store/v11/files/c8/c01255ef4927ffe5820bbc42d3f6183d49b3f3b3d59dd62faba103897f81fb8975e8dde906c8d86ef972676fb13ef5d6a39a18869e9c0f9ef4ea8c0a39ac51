'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const async = require("async");
const _suman = global.__suman = (global.__suman || {});
let runQueue = null;
exports.getRunQueue = function () {
    return runQueue;
};
exports.makeRunQueue = function () {
    const { maxProcs } = _suman;
    return runQueue = async.queue((task, cb) => task(cb), maxProcs);
};
let transpileQueue = null;
exports.getTranspileQueue = function () {
    return transpileQueue;
};
exports.makeTranspileQueue = function (failedTransformObjects, runFile, queuedTestFns) {
    const { sumanOpts, sumanConfig, projectRoot } = _suman;
    const waitForAllTranformsToFinish = sumanOpts.wait_for_all_transforms;
    return transpileQueue = async.queue(function (task, cb) {
        task(function (err, file, shortFile, stdout, stderr, gd) {
            if (err) {
                _suman.log.error('transform error => ', err.stack || err);
                failedTransformObjects.push({ err, file, shortFile, stdout, stderr });
                return;
            }
            setImmediate(cb);
            if (waitForAllTranformsToFinish) {
                queuedTestFns.push(function () {
                    runFile(file, shortFile, stdout, gd);
                });
            }
            else {
                runFile(file, shortFile, stdout, gd);
            }
        });
    }, 3);
};
