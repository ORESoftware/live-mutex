'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const assert = require("assert");
const pragmatik = require('pragmatik');
const _suman = global.__suman = (global.__suman || {});
exports.createSignature = pragmatik.signature({
    mode: 'strict',
    allowExtraneousTrailingVars: false,
    signatureDescription: '(s: string, opts?: Object, f: Array | Function)',
    args: [
        {
            type: 'string',
            default: function () {
                return '[suman-placeholder]';
            },
            required: false,
            errorMessage: function (r) {
                return 'First argument to describe/suite blocks must be a string description/title with a length greater than zero.\n' +
                    'The signature is ' + r.signatureDescription;
            },
            checks: [
                function (val, rule) {
                    assert(val.length > 0, rule.errorMessage);
                }
            ]
        },
        {
            type: 'object',
            required: false,
            errorMessage: function (r) {
                return 'Options object should be an object and not an array.' +
                    'The signature is ' + r.signatureDescription;
            },
            default: function () {
                return {};
            },
            checks: [
                function (val, rule) {
                    assert(typeof val === 'object' && !Array.isArray(val), rule.errorMessage +
                        ', instead we got => ' + util.inspect(val));
                }
            ]
        },
        {
            type: 'array',
            required: false,
            errorMessage: function (r) {
                return 'Callback function is required for describe/suite blocks.' +
                    'The signature is ' + r.signatureDescription;
            },
            postChecks: [
                function (index, values) {
                    if (values[index] && values[index + 1]) {
                        throw new Error(' => Suman usage error => function and array were both passed; please choose only one.');
                    }
                }
            ]
        },
        {
            type: 'function',
            required: false,
            errorMessage: function (r) {
                return 'Callback function is required for describe/suite blocks.' +
                    'The signature is ' + r.signatureDescription;
            },
            postChecks: [
                function (index, values) {
                    if (values[index] && values[index - 1]) {
                        throw new Error(' => Suman usage error => function and array were both passed; please choose only one.');
                    }
                }
            ]
        }
    ]
});
exports.blockSignature = pragmatik.signature({
    mode: 'strict',
    allowExtraneousTrailingVars: false,
    signatureDescription: '(s: string, opts?: Object, f: Array | Function)',
    args: [
        {
            type: 'string',
            required: true,
            errorMessage: function (r) {
                return 'First argument to describe/suite blocks must be a string description/title with a length greater than zero.\n' +
                    'The signature is ' + r.signatureDescription;
            },
            checks: [
                function (val, rule) {
                    assert(val.length > 0, rule.errorMessage);
                }
            ]
        },
        {
            type: 'object',
            required: false,
            errorMessage: function (r) {
                return 'Options object should be an object and not an array.' +
                    'The signature is ' + r.signatureDescription;
            },
            default: function () {
                return {};
            },
            checks: [
                function (val, rule) {
                    assert(typeof val === 'object' && !Array.isArray(val), rule.errorMessage +
                        ', instead we got => ' + util.inspect(val));
                }
            ]
        },
        {
            type: 'array',
            required: false,
            errorMessage: function (r) {
                return 'Callback function is required for describe/suite blocks.' +
                    'The signature is ' + r.signatureDescription;
            },
            postChecks: [
                function (index, values) {
                    if (values[index] && values[index + 1]) {
                        throw new Error('Suman usage error => function and array were both passed; please choose only one.');
                    }
                }
            ]
        },
        {
            type: 'function',
            required: false,
            errorMessage: function (r) {
                return 'Callback function is required for describe/suite blocks.' +
                    'The signature is ' + r.signatureDescription;
            },
            postChecks: [
                function (index, values) {
                    if (values[index] && values[index - 1]) {
                        throw new Error('Suman usage error => function and array were both passed; please choose only one.');
                    }
                }
            ]
        }
    ]
});
exports.hookSignature = pragmatik.signature({
    mode: 'strict',
    allowExtraneousTrailingVars: false,
    signatureDescription: '(s: string, opts?: Object, f?: Function)',
    args: [
        {
            type: 'string',
            required: false,
            errorMessage: function (r) {
                return 'First argument must be a string description/title for the hook with a length greater than zero.\n' +
                    'Signature is => ' + r.signatureDescription;
            },
            checks: [
                function (val, rule) {
                    assert(val.length > 0, rule.errorMessage);
                }
            ]
        },
        {
            type: 'object',
            required: false,
            errorMessage: function (r) {
                return 'Options object should be an object and not an array ' +
                    '=> Signature for all hooks is => ' + r.signatureDescription;
            },
            default: function () {
                return {};
            },
            checks: [
                function (val) {
                    assert(typeof val === 'object' && !Array.isArray(val), 'Options object should be a plain {} object,' +
                        'instead we got => ' + util.inspect(val));
                }
            ]
        },
        {
            type: 'array',
            required: false,
            errorMessage: function (r) {
                return 'Callback function is required for describe/suite blocks.' +
                    'The signature is ' + r.signatureDescription;
            },
            postChecks: [
                function (index, values) {
                    if (values[index] && values[index + 1]) {
                        throw new Error(' => Suman usage error => function and array were both passed; please choose only one.');
                    }
                }
            ]
        },
        {
            type: 'function',
            required: false,
            errorMessage: function (r) {
                return 'Callback function must be a function. ' +
                    'Signature for all hooks is => ' + r.signatureDescription;
            },
            checks: [
                function (val, rules, retArgs) {
                    if (typeof val !== 'function') {
                        assert(typeof retArgs[0] === 'string', 'For Suman hooks (before/after/beforeEach/afterEach), if you do not\n' +
                            'provide a callback (hook is stubbed) then you must provide a string description as the first argument.');
                    }
                }
            ],
            postChecks: [
                function (index, values) {
                    if (values[index] && values[index - 1]) {
                        throw new Error(' => Suman usage error => function and array were both passed; please choose only one.');
                    }
                }
            ]
        }
    ]
});
exports.testCaseSignature = pragmatik.signature({
    mode: 'strict',
    allowExtraneousTrailingVars: false,
    signatureDescription: '(String s, [Object opts, Function f])',
    args: [
        {
            type: 'string',
            required: true,
            errorMessage: function (r) {
                return 'First argument for test cases must be a string description/title, ' +
                    'with a length greater than zero.\n' +
                    'Signature for test cases is => ' + r.signatureDescription;
            },
            checks: [
                function (val, rule) {
                    assert(val.length > 0, rule.errorMessage);
                }
            ]
        },
        {
            type: 'object',
            required: false,
            errorMessage: function (r) {
                return 'Options object should be an object and not an array. ' +
                    'Signature for test cases is => ' + r.signatureDescription;
            },
            default: function () {
                return {};
            },
            checks: [
                function (val) {
                    assert(typeof val === 'object' && !Array.isArray(val), 'Options object should be a plain {} object,' +
                        'instead we got => ' + util.inspect(val));
                }
            ]
        },
        {
            type: 'array',
            required: false,
            errorMessage: function (r) {
                return 'Callback function is required for describe/suite blocks.' +
                    'The signature is ' + r.signatureDescription;
            },
            postChecks: [
                function (index, values) {
                    if (values[index] && values[index + 1]) {
                        throw new Error(' => Suman usage error => function and array were both passed; please choose only one.');
                    }
                }
            ]
        },
        {
            type: 'function',
            required: false,
            errorMessage: function (r) {
                return 'Callback function must be a function. ' +
                    'Signature for test cases is => ' + r.signatureDescription;
            },
            checks: [
                function (val, rules, retArgs) {
                    if (typeof val !== 'function') {
                        assert(typeof retArgs[0] === 'string', 'For Suman hooks (before/after/beforeEach/afterEach), if you do not\n' +
                            'provide a callback (hook is stubbed) then you must provide a string description as the first argument.');
                    }
                }
            ],
            postChecks: [
                function (index, values) {
                    if (values[index] && values[index - 1]) {
                        throw new Error(' => Suman usage error => function and array were both passed; please choose only one.');
                    }
                }
            ]
        }
    ]
});
