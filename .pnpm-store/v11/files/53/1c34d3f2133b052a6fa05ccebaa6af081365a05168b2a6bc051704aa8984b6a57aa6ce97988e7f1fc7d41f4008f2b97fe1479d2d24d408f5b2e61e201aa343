'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const _ = require("lodash");
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const general_1 = require("../helpers/general");
const defaultSuccessEvents = ['success', 'finish', 'close', 'end', 'done'];
const defaultErrorEvents = ['error'];
exports.handleReturnVal = function (done, fnStr, testOrHook) {
    return function handle(val, warn) {
        if ((!val || (typeof val.then !== 'function')) && warn) {
            _suman.writeTestError('\n Suman warning: you may have forgotten to return a Promise => \n' + fnStr + '\n');
        }
        if (su.isObservable(val)) {
            val.subscribe(function onNext(val) {
                _suman.log.info('Observable subscription onNext => ', util.inspect(val));
            }, function onError(e) {
                done(e || new Error('Suman dummy error.'));
            }, function onCompleted() {
                done();
            });
        }
        else if (su.isSubscriber(val)) {
            const _next = val._next;
            const _error = val._error;
            const _complete = val._complete;
            val._next = function () {
                _next.apply(val, arguments);
            };
            val._error = function (e) {
                _error.apply(val, arguments);
                done(e || new Error('Suman dummy error.'));
            };
            val._complete = function () {
                _complete.apply(val, arguments);
                done();
            };
        }
        else if (su.isStream(val) || su.isEventEmitter(val)) {
            let first = true;
            let onSuccess = function () {
                if (first) {
                    first = false;
                    process.nextTick(done);
                }
            };
            let onError = function (e) {
                if (first) {
                    first = false;
                    process.nextTick(done, e || new Error('Suman dummy error.'));
                }
            };
            const eventsSuccess = testOrHook.events && testOrHook.events.success;
            const eventsError = testOrHook.events && testOrHook.events.error;
            const successEvents = _.flattenDeep([testOrHook.successEvents, eventsSuccess, defaultSuccessEvents]);
            successEvents.filter(function (v, i, a) {
                if (v && typeof v !== 'string') {
                    _suman.log.error(new Error('Value passed to success events was not a string: ' + util.inspect(v)));
                    return false;
                }
                return v && a.indexOf(v) === i;
            })
                .forEach(function (name) {
                val.once(name, onSuccess);
            });
            const errorEvents = _.flattenDeep([testOrHook.errorEvents, eventsError, defaultErrorEvents]);
            errorEvents.filter(function (v, i, a) {
                if (v && typeof v !== 'string') {
                    _suman.log.error(new Error('Value passed to error events was not a string: ' + util.inspect(v)));
                    return false;
                }
                return v && a.indexOf(v) === i;
            })
                .forEach(function (name) {
                val.once(name, onError);
            });
        }
        else {
            Promise.resolve(val).then(function () {
                done(null);
            }, function (err) {
                done(err || new Error('Suman unkwnown error'));
            });
        }
    };
};
exports.handleGenerator = function (fn, arg) {
    const gen = general_1.makeRunGenerator(fn, null);
    return gen.call(null, arg);
};
