'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var suman = require("suman");
var Test = suman.init(module).Test;
global.Promise = require('bluebird');
var dist_1 = require("../../dist");
///////////////////////////////////////////////////////////////////////////////////////
Test.create(['Promise', function (b, it, inject, describe, before, $deps) {
        var _this = this;
        var Promise = b.ioc.Promise;
        var colors = $deps.chalk;
        var conf = Object.freeze({ port: 7035 });
        before(function (h) { return new dist_1.Broker(conf).start(); });
        before('get client', function (h) {
            return new dist_1.Client(conf).ensure().then(function (c) {
                h.supply.client = c;
            });
        });
        describe('do all in parallel', { parallel: true }, function (b) {
            describe('injected', function (b) {
                it('locks/unlocks', function (t) {
                    var c = t.supply.client;
                    return c.lockp('a').then(function (v) {
                        return c.unlockp('a');
                    });
                });
            });
            it('locks/unlocks', function (t) {
                var c = t.supply.client;
                return c.lockp('a').then(function (v) {
                    return c.unlockp('a');
                });
            });
            // const promhelper = function (unlock) {
            //   return new Promise(function (resolve, reject) {
            //     unlock(function (err) {
            //       err ? reject(err) : resolve();
            //     });
            //   });
            // };
            var makePromiseProvider = function (unlock) {
                return function (input) {
                    return Promise.resolve(input).then(function () {
                        return new Promise(function (resolve, reject) {
                            unlock(function (err) {
                                err ? reject(err) : resolve();
                            });
                        });
                    });
                };
            };
            it('locks/unlocks super special 1', function (t) {
                var c = t.supply.client;
                return c.lockp('foo').then(function (_a) {
                    var unlock = _a.unlock;
                    return (unlock);
                });
            });
            it('locks/unlocks super special 2', function (t) { return __awaiter(_this, void 0, void 0, function () {
                var c, unlock;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            c = t.supply.client;
                            return [4 /*yield*/, c.acquire('foo')];
                        case 1:
                            unlock = (_a.sent()).unlock;
                            return [2 /*return*/, c.promisifyUnlock(unlock)];
                    }
                });
            }); });
            it('locks/unlocks super special 2', function (t) { return __awaiter(_this, void 0, void 0, function () {
                var c, unlock, provider, v;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            c = t.supply.client;
                            return [4 /*yield*/, c.lockp('foo')];
                        case 1:
                            unlock = (_a.sent()).unlock;
                            provider = makePromiseProvider(unlock);
                            return [4 /*yield*/, Promise.resolve(123)];
                        case 2:
                            v = _a.sent();
                            return [2 /*return*/, provider(String(v))];
                    }
                });
            }); });
            it('locks/unlocks super special 3', function (t) {
                var c = t.supply.client;
                return c.lockp('foo').then(function (_a) {
                    var unlock = _a.unlock;
                    return new Promise(function (resolve, reject) {
                        unlock(function (err) {
                            err ? reject(err) : resolve();
                        });
                    });
                });
            });
            it('locks/unlocks', function (t) { return __awaiter(_this, void 0, void 0, function () {
                var c;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            c = t.supply.client;
                            return [4 /*yield*/, c.lockp('a')];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, Promise.delay(100)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, c.unlockp('a')];
                    }
                });
            }); });
        });
    }]);
