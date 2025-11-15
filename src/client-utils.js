'use strict';
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwClientError = exports.getClientError = exports.getClientErrorMessage = exports.log = void 0;
var chalk_1 = require("chalk");
var shared_internal_1 = require("./shared-internal");
var debugLog = process.argv.indexOf('--lmx-debug') > 0;
exports.log = {
    info: console.log.bind(console, chalk_1.default.gray.bold('lmx client info:')),
    warn: console.error.bind(console, chalk_1.default.magenta.bold('lmx client warning:')),
    error: console.error.bind(console, chalk_1.default.red.bold('lmx client error:')),
    fatal: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        console.error.apply(console, __spreadArray(['lmx client fatal error:'], arguments, false));
        process.exit(1);
    },
    debug: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (debugLog) {
            var newTime = Date.now();
            var elapsed = newTime - shared_internal_1.forDebugging.previousTime;
            shared_internal_1.forDebugging.previousTime = newTime;
            console.log.apply(console, __spreadArray([chalk_1.default.yellow.bold('lmx client debugging:'), 'elapsed millis:', "(".concat(elapsed, ")")], args, false));
        }
    }
};
var getClientErrorMessage = function (s) {
    return "lmx client error: ".concat(s);
};
exports.getClientErrorMessage = getClientErrorMessage;
var getClientError = function (s) {
    return new Error("lmx client error: ".concat(s));
};
exports.getClientError = getClientError;
var throwClientError = function (s) {
    throw new Error("lmx client error: ".concat(s));
};
exports.throwClientError = throwClientError;
