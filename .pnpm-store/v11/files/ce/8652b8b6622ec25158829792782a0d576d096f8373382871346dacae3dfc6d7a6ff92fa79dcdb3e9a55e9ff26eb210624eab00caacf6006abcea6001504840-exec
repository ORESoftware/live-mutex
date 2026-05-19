'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const { events } = require('suman-events');
const _suman = global.__suman = (global.__suman || {});
const utils_1 = require("../../lib/utils");
const reporterName = path.basename(__dirname);
const log = utils_1.getLogger(reporterName);
exports.loadReporter = utils_1.wrapReporter(reporterName, (retContainer, results, s, sumanOpts) => {
    return retContainer.ret = {
        results,
        reporterName
    };
});
exports.default = exports.loadReporter;
