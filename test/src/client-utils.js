'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwClientError = exports.getClientError = exports.getClientErrorMessage = exports.log = void 0;
const chalk_1 = __importDefault(require("chalk"));
const shared_internal_1 = require("./shared-internal");
const debugLog = process.argv.indexOf('--lmx-debug') > 0;
exports.log = {
    info: console.log.bind(console, chalk_1.default.gray.bold('lmx client info:')),
    warn: console.error.bind(console, chalk_1.default.magenta.bold('lmx client warning:')),
    error: console.error.bind(console, chalk_1.default.red.bold('lmx client error:')),
    fatal(...args) {
        console.error('lmx client fatal error:', ...arguments);
        process.exit(1);
    },
    debug(...args) {
        if (debugLog) {
            let newTime = Date.now();
            let elapsed = newTime - shared_internal_1.forDebugging.previousTime;
            shared_internal_1.forDebugging.previousTime = newTime;
            console.log(chalk_1.default.yellow.bold('lmx client debugging:'), 'elapsed millis:', `(${elapsed})`, ...args);
        }
    }
};
const getClientErrorMessage = (s) => {
    return `lmx client error: ${s}`;
};
exports.getClientErrorMessage = getClientErrorMessage;
const getClientError = (s) => {
    return new Error(`lmx client error: ${s}`);
};
exports.getClientError = getClientError;
const throwClientError = (s) => {
    throw new Error(`lmx client error: ${s}`);
};
exports.throwClientError = throwClientError;
