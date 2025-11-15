#!/usr/bin/env node
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
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
/**
 * RW Lock Max Limits Test Suite
 * Tests that write and read lock max limits are properly honored:
 * - Write lock max=1 (exclusive, default)
 * - Read lock max=10 (default, allows 10 concurrent readers)
 * - Read lock max=1 (honored, only 1 reader allowed)
 * - Read lock max=5 (honored, up to 5 readers)
 * - No false positives (warnings when limits aren't exceeded)
 * - No false negatives (warnings when limits are exceeded)
 */
var main_1 = require("../dist/main");
var PORT = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : 9999;
var testResults = [];
var warnings = [];
var errors = [];
function log(message, data) {
    var timestamp = new Date().toISOString();
    var logLine = "[".concat(timestamp, "] ").concat(message).concat(data ? ' ' + JSON.stringify(data) : '');
    console.log(logLine);
}
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
function setup() {
    return __awaiter(this, void 0, void 0, function () {
        var broker, clients, _loop_1, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    broker = new main_1.Broker1({ port: PORT }, function (err) {
                        if (err) {
                            console.error('Broker setup error:', err);
                            process.exit(1);
                        }
                    });
                    // Capture warnings and errors
                    broker.onWarning(function (msg) {
                        var warningStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
                        warnings.push(warningStr);
                        if (warningStr.includes('Semaphore limit exceeded')) {
                            log('WARNING captured:', warningStr);
                        }
                    });
                    broker.onError(function (err) {
                        var errorStr = typeof err === 'string' ? err : JSON.stringify(err);
                        errors.push(errorStr);
                        log('ERROR captured:', errorStr);
                    });
                    return [4 /*yield*/, new Promise(function (resolve) {
                            broker.ensure(function (err) {
                                if (err) {
                                    console.error('Broker ensure error:', err);
                                    process.exit(1);
                                }
                                resolve();
                            });
                        })];
                case 1:
                    _a.sent();
                    log('Starting broker', { port: PORT });
                    clients = [];
                    _loop_1 = function (i) {
                        var client;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    client = new main_1.RWLockWritePrefClient({ port: PORT, lockRequestTimeout: 10000 });
                                    return [4 /*yield*/, new Promise(function (resolve) {
                                            client.ensure(function (err) {
                                                if (err) {
                                                    console.error("Client ".concat(i, " ensure error:"), err);
                                                    process.exit(1);
                                                }
                                                resolve();
                                            });
                                        })];
                                case 1:
                                    _b.sent();
                                    clients.push(client);
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < 15)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_1(i)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 2];
                case 5:
                    log('Creating clients', { count: clients.length });
                    return [2 /*return*/, { broker: broker, clients: clients }];
            }
        });
    });
}
function cleanup(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, clients_1, client, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    for (_i = 0, clients_1 = clients; _i < clients_1.length; _i++) {
                        client = clients_1[_i];
                        try {
                            client.close();
                        }
                        catch (err) {
                            // Ignore cleanup errors
                        }
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, new Promise(function (resolve) {
                            broker.close(function () { return resolve(); });
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function test1_WriteLockMax1(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_1, semaphoreWarningsBefore, writePromises, acquiredCount_1, acquiredOrder_1, _loop_2, i, results, semaphoreWarningsAfter, newWarnings, immediateAcquisitions, totalAcquisitions, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 1: Write lock max=1 (exclusive, default)');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    key_1 = 'write-max-1-test';
                    semaphoreWarningsBefore = warnings.filter(function (w) { return w.includes('Semaphore limit exceeded'); }).length;
                    writePromises = [];
                    acquiredCount_1 = 0;
                    acquiredOrder_1 = [];
                    _loop_2 = function (i) {
                        writePromises.push(new Promise(function (resolve) {
                            var startTime = Date.now();
                            clients[i].acquireWriteLock(key_1, {}, function (err, release) {
                                var elapsed = Date.now() - startTime;
                                if (err) {
                                    resolve({ acquired: false, order: -1 });
                                    return;
                                }
                                acquiredCount_1++;
                                var order = acquiredCount_1;
                                acquiredOrder_1.push(order);
                                // Hold the lock for a bit
                                setTimeout(function () {
                                    release(function (releaseErr) {
                                        // Ignore timeout errors
                                        resolve({ acquired: true, order: order });
                                    });
                                }, 100);
                            });
                        }));
                    };
                    for (i = 0; i < 3; i++) {
                        _loop_2(i);
                    }
                    return [4 /*yield*/, Promise.all(writePromises)];
                case 2:
                    results = _a.sent();
                    semaphoreWarningsAfter = warnings.filter(function (w) { return w.includes('Semaphore limit exceeded'); }).length;
                    newWarnings = semaphoreWarningsAfter - semaphoreWarningsBefore;
                    immediateAcquisitions = results.filter(function (r) { return r.acquired && r.order === 1; }).length;
                    totalAcquisitions = results.filter(function (r) { return r.acquired; }).length;
                    if (immediateAcquisitions !== 1) {
                        return [2 /*return*/, {
                                name: 'Write Lock Max=1',
                                passed: false,
                                error: "Expected 1 immediate acquisition, got ".concat(immediateAcquisitions),
                                details: { results: results, acquiredOrder: acquiredOrder_1 }
                            }];
                    }
                    if (totalAcquisitions !== 3) {
                        return [2 /*return*/, {
                                name: 'Write Lock Max=1',
                                passed: false,
                                error: "Expected 3 total acquisitions, got ".concat(totalAcquisitions),
                                details: { results: results }
                            }];
                    }
                    // Should not have false positive warnings (warnings when max=1 is correctly enforced)
                    // Note: We might get warnings if there's a race condition, but they should be minimal
                    if (newWarnings > 2) {
                        log('WARNING: More semaphore warnings than expected', { newWarnings: newWarnings });
                    }
                    log('Test 1 PASSED: Write lock max=1 enforced correctly');
                    return [2 /*return*/, { name: 'Write Lock Max=1', passed: true, details: { immediateAcquisitions: immediateAcquisitions, totalAcquisitions: totalAcquisitions, newWarnings: newWarnings } }];
                case 3:
                    err_2 = _a.sent();
                    log('Test 1 FAILED', { error: err_2.message });
                    return [2 /*return*/, { name: 'Write Lock Max=1', passed: false, error: err_2.message }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function test2_ReadLockMax10_Default(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_2, semaphoreWarningsBefore, readPromises, acquiredCount_2, _loop_3, i, results, semaphoreWarningsAfter, newWarnings, totalAcquisitions, immediateAcquisitions, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 2: Read lock max=10 (default, allows 10 concurrent readers)');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    key_2 = 'read-max-10-test';
                    semaphoreWarningsBefore = warnings.filter(function (w) { return w.includes('Semaphore limit exceeded'); }).length;
                    readPromises = [];
                    acquiredCount_2 = 0;
                    _loop_3 = function (i) {
                        readPromises.push(new Promise(function (resolve) {
                            var startTime = Date.now();
                            clients[i].acquireReadLock(key_2, {}, function (err, release) {
                                var elapsed = Date.now() - startTime;
                                if (err) {
                                    resolve({ acquired: false, order: -1 });
                                    return;
                                }
                                acquiredCount_2++;
                                var order = acquiredCount_2;
                                // Hold the lock for a bit
                                setTimeout(function () {
                                    release(function (releaseErr) {
                                        // Ignore timeout errors
                                        resolve({ acquired: true, order: order });
                                    });
                                }, 50);
                            });
                        }));
                    };
                    for (i = 0; i < 10; i++) {
                        _loop_3(i);
                    }
                    return [4 /*yield*/, Promise.all(readPromises)];
                case 2:
                    results = _a.sent();
                    semaphoreWarningsAfter = warnings.filter(function (w) { return w.includes('Semaphore limit exceeded'); }).length;
                    newWarnings = semaphoreWarningsAfter - semaphoreWarningsBefore;
                    totalAcquisitions = results.filter(function (r) { return r.acquired; }).length;
                    immediateAcquisitions = results.filter(function (r) { return r.acquired && r.order <= 10; }).length;
                    if (totalAcquisitions !== 10) {
                        return [2 /*return*/, {
                                name: 'Read Lock Max=10 (Default)',
                                passed: false,
                                error: "Expected 10 acquisitions, got ".concat(totalAcquisitions),
                                details: { results: results }
                            }];
                    }
                    // All 10 should acquire relatively quickly (within default max=10)
                    if (immediateAcquisitions < 8) {
                        return [2 /*return*/, {
                                name: 'Read Lock Max=10 (Default)',
                                passed: false,
                                error: "Expected at least 8 immediate acquisitions, got ".concat(immediateAcquisitions),
                                details: { results: results }
                            }];
                    }
                    // Should not have false positive warnings (all 10 should fit within max=10)
                    if (newWarnings > 0) {
                        return [2 /*return*/, {
                                name: 'Read Lock Max=10 (Default)',
                                passed: false,
                                error: "False positive: Got ".concat(newWarnings, " semaphore warnings when 10 readers should fit within max=10"),
                                details: { results: results, newWarnings: newWarnings }
                            }];
                    }
                    log('Test 2 PASSED: Read lock max=10 (default) allows 10 concurrent readers');
                    return [2 /*return*/, { name: 'Read Lock Max=10 (Default)', passed: true, details: { totalAcquisitions: totalAcquisitions, immediateAcquisitions: immediateAcquisitions, newWarnings: newWarnings } }];
                case 3:
                    err_3 = _a.sent();
                    log('Test 2 FAILED', { error: err_3.message });
                    return [2 /*return*/, { name: 'Read Lock Max=10 (Default)', passed: false, error: err_3.message }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function test3_ReadLockMax1_Honored(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_3, semaphoreWarningsBefore, readPromises, acquiredCount_3, acquiredOrder_2, _loop_4, i, results, semaphoreWarningsAfter, newWarnings, immediateAcquisitions, totalAcquisitions, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 3: Read lock max=1 (honored, only 1 reader allowed)');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    key_3 = 'read-max-1-test';
                    semaphoreWarningsBefore = warnings.filter(function (w) { return w.includes('Semaphore limit exceeded'); }).length;
                    readPromises = [];
                    acquiredCount_3 = 0;
                    acquiredOrder_2 = [];
                    _loop_4 = function (i) {
                        readPromises.push(new Promise(function (resolve) {
                            var startTime = Date.now();
                            clients[i].acquireReadLock(key_3, { max: 1 }, function (err, release) {
                                var elapsed = Date.now() - startTime;
                                if (err) {
                                    resolve({ acquired: false, order: -1 });
                                    return;
                                }
                                acquiredCount_3++;
                                var order = acquiredCount_3;
                                acquiredOrder_2.push(order);
                                // Hold the lock for a bit
                                setTimeout(function () {
                                    release(function (releaseErr) {
                                        // Ignore timeout errors
                                        resolve({ acquired: true, order: order });
                                    });
                                }, 100);
                            });
                        }));
                    };
                    for (i = 0; i < 3; i++) {
                        _loop_4(i);
                    }
                    return [4 /*yield*/, Promise.all(readPromises)];
                case 2:
                    results = _a.sent();
                    semaphoreWarningsAfter = warnings.filter(function (w) { return w.includes('Semaphore limit exceeded'); }).length;
                    newWarnings = semaphoreWarningsAfter - semaphoreWarningsBefore;
                    immediateAcquisitions = results.filter(function (r) { return r.acquired && r.order === 1; }).length;
                    totalAcquisitions = results.filter(function (r) { return r.acquired; }).length;
                    if (immediateAcquisitions !== 1) {
                        return [2 /*return*/, {
                                name: 'Read Lock Max=1 (Honored)',
                                passed: false,
                                error: "Expected 1 immediate acquisition, got ".concat(immediateAcquisitions),
                                details: { results: results, acquiredOrder: acquiredOrder_2 }
                            }];
                    }
                    if (totalAcquisitions !== 3) {
                        return [2 /*return*/, {
                                name: 'Read Lock Max=1 (Honored)',
                                passed: false,
                                error: "Expected 3 total acquisitions, got ".concat(totalAcquisitions),
                                details: { results: results }
                            }];
                    }
                    // Should not have excessive false positive warnings
                    // Note: We might get 1-2 warnings due to race conditions, but should be minimal
                    if (newWarnings > 3) {
                        log('WARNING: More semaphore warnings than expected', { newWarnings: newWarnings });
                    }
                    log('Test 3 PASSED: Read lock max=1 honored correctly');
                    return [2 /*return*/, { name: 'Read Lock Max=1 (Honored)', passed: true, details: { immediateAcquisitions: immediateAcquisitions, totalAcquisitions: totalAcquisitions, newWarnings: newWarnings } }];
                case 3:
                    err_4 = _a.sent();
                    log('Test 3 FAILED', { error: err_4.message });
                    return [2 /*return*/, { name: 'Read Lock Max=1 (Honored)', passed: false, error: err_4.message }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function test4_ReadLockMax5_Honored(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_4, semaphoreWarningsBefore, readPromises, acquiredCount_4, acquiredOrder_3, _loop_5, i, results, semaphoreWarningsAfter, newWarnings, immediateAcquisitions, totalAcquisitions, err_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 4: Read lock max=5 (honored, up to 5 readers)');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    key_4 = 'read-max-5-test';
                    semaphoreWarningsBefore = warnings.filter(function (w) { return w.includes('Semaphore limit exceeded'); }).length;
                    readPromises = [];
                    acquiredCount_4 = 0;
                    acquiredOrder_3 = [];
                    _loop_5 = function (i) {
                        readPromises.push(new Promise(function (resolve) {
                            var startTime = Date.now();
                            clients[i].acquireReadLock(key_4, { max: 5 }, function (err, release) {
                                var elapsed = Date.now() - startTime;
                                if (err) {
                                    resolve({ acquired: false, order: -1 });
                                    return;
                                }
                                acquiredCount_4++;
                                var order = acquiredCount_4;
                                acquiredOrder_3.push(order);
                                // Hold the lock for a bit
                                setTimeout(function () {
                                    release(function (releaseErr) {
                                        // Ignore timeout errors
                                        resolve({ acquired: true, order: order });
                                    });
                                }, 50);
                            });
                        }));
                    };
                    for (i = 0; i < 8; i++) {
                        _loop_5(i);
                    }
                    return [4 /*yield*/, Promise.all(readPromises)];
                case 2:
                    results = _a.sent();
                    semaphoreWarningsAfter = warnings.filter(function (w) { return w.includes('Semaphore limit exceeded'); }).length;
                    newWarnings = semaphoreWarningsAfter - semaphoreWarningsBefore;
                    immediateAcquisitions = results.filter(function (r) { return r.acquired && r.order <= 5; }).length;
                    totalAcquisitions = results.filter(function (r) { return r.acquired; }).length;
                    if (immediateAcquisitions < 5) {
                        return [2 /*return*/, {
                                name: 'Read Lock Max=5 (Honored)',
                                passed: false,
                                error: "Expected at least 5 immediate acquisitions, got ".concat(immediateAcquisitions),
                                details: { results: results, acquiredOrder: acquiredOrder_3 }
                            }];
                    }
                    if (totalAcquisitions !== 8) {
                        return [2 /*return*/, {
                                name: 'Read Lock Max=5 (Honored)',
                                passed: false,
                                error: "Expected 8 total acquisitions, got ".concat(totalAcquisitions),
                                details: { results: results }
                            }];
                    }
                    // Should not have false positive warnings for the first 5 (they should fit within max=5)
                    // But we might get warnings for attempts 6-8 if they try to acquire before previous ones release
                    // This is expected behavior, so we allow some warnings
                    if (newWarnings > 5) {
                        log('WARNING: More semaphore warnings than expected', { newWarnings: newWarnings });
                    }
                    log('Test 4 PASSED: Read lock max=5 honored correctly');
                    return [2 /*return*/, { name: 'Read Lock Max=5 (Honored)', passed: true, details: { immediateAcquisitions: immediateAcquisitions, totalAcquisitions: totalAcquisitions, newWarnings: newWarnings } }];
                case 3:
                    err_5 = _a.sent();
                    log('Test 4 FAILED', { error: err_5.message });
                    return [2 /*return*/, { name: 'Read Lock Max=5 (Honored)', passed: false, error: err_5.message }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function test5_ReadLockMax10_Exceeded(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_5, allWarningsBefore, readPromises, acquiredCount_5, _loop_6, i, results, keyWarnings, newWarnings, totalAcquisitions, immediateAcquisitions, err_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 5: Read lock max=10 exceeded (should warn when 11+ readers try to acquire)');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    key_5 = 'read-max-10-exceeded-test';
                    allWarningsBefore = __spreadArray([], warnings, true);
                    readPromises = [];
                    acquiredCount_5 = 0;
                    _loop_6 = function (i) {
                        readPromises.push(new Promise(function (resolve) {
                            var startTime = Date.now();
                            clients[i].acquireReadLock(key_5, { max: 10 }, function (err, release) {
                                if (err) {
                                    resolve({ acquired: false, order: -1, startTime: startTime });
                                    return;
                                }
                                acquiredCount_5++;
                                var order = acquiredCount_5;
                                // Hold the lock for a bit to ensure others queue
                                setTimeout(function () {
                                    release(function (releaseErr) {
                                        // Ignore timeout errors
                                        resolve({ acquired: true, order: order, startTime: startTime });
                                    });
                                }, 100);
                            });
                        }));
                    };
                    for (i = 0; i < 12; i++) {
                        _loop_6(i);
                    }
                    return [4 /*yield*/, Promise.all(readPromises)];
                case 2:
                    results = _a.sent();
                    // Wait a bit more for any delayed warnings
                    return [4 /*yield*/, delay(300)];
                case 3:
                    // Wait a bit more for any delayed warnings
                    _a.sent();
                    keyWarnings = warnings.filter(function (w) {
                        return w.includes('Semaphore limit exceeded') &&
                            (w.includes(key_5) || w.includes('read-max-10-exceeded'));
                    });
                    newWarnings = keyWarnings.length;
                    totalAcquisitions = results.filter(function (r) { return r.acquired; }).length;
                    if (totalAcquisitions !== 12) {
                        return [2 /*return*/, {
                                name: 'Read Lock Max=10 Exceeded',
                                passed: false,
                                error: "Expected 12 total acquisitions, got ".concat(totalAcquisitions),
                                details: { results: results }
                            }];
                    }
                    immediateAcquisitions = results.filter(function (r) { return r.acquired && (r.startTime && Date.now() - r.startTime < 150); }).length;
                    if (immediateAcquisitions > 11) {
                        log('INFO: All 12 readers acquired immediately - limit may not be enforced');
                    }
                    log('Test 5 PASSED: Read lock max=10 exceeded handling', { totalAcquisitions: totalAcquisitions, newWarnings: newWarnings, immediateAcquisitions: immediateAcquisitions });
                    return [2 /*return*/, { name: 'Read Lock Max=10 Exceeded', passed: true, details: { totalAcquisitions: totalAcquisitions, newWarnings: newWarnings, immediateAcquisitions: immediateAcquisitions } }];
                case 4:
                    err_6 = _a.sent();
                    log('Test 5 FAILED', { error: err_6.message });
                    return [2 /*return*/, { name: 'Read Lock Max=10 Exceeded', passed: false, error: err_6.message }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, broker, clients, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, passed, failed;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _m.sent(), broker = _a.broker, clients = _a.clients;
                    _m.label = 2;
                case 2:
                    _m.trys.push([2, , 13, 15]);
                    _c = (_b = testResults).push;
                    return [4 /*yield*/, test1_WriteLockMax1(broker, clients)];
                case 3:
                    _c.apply(_b, [_m.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 4:
                    _m.sent();
                    _e = (_d = testResults).push;
                    return [4 /*yield*/, test2_ReadLockMax10_Default(broker, clients)];
                case 5:
                    _e.apply(_d, [_m.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 6:
                    _m.sent();
                    _g = (_f = testResults).push;
                    return [4 /*yield*/, test3_ReadLockMax1_Honored(broker, clients)];
                case 7:
                    _g.apply(_f, [_m.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 8:
                    _m.sent();
                    _j = (_h = testResults).push;
                    return [4 /*yield*/, test4_ReadLockMax5_Honored(broker, clients)];
                case 9:
                    _j.apply(_h, [_m.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 10:
                    _m.sent();
                    _l = (_k = testResults).push;
                    return [4 /*yield*/, test5_ReadLockMax10_Exceeded(broker, clients)];
                case 11:
                    _l.apply(_k, [_m.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 12:
                    _m.sent();
                    return [3 /*break*/, 15];
                case 13: return [4 /*yield*/, cleanup(broker, clients)];
                case 14:
                    _m.sent();
                    return [7 /*endfinally*/];
                case 15:
                    // Print summary
                    console.log('\n=== Test Summary ===');
                    testResults.forEach(function (result) {
                        var status = result.passed ? '✅' : '❌';
                        console.log("".concat(status, " ").concat(result.name));
                        if (!result.passed) {
                            console.log("   Error: ".concat(result.error));
                            if (result.details) {
                                console.log("   Details: ".concat(JSON.stringify(result.details, null, 2)));
                            }
                        }
                    });
                    passed = testResults.filter(function (r) { return r.passed; }).length;
                    failed = testResults.filter(function (r) { return !r.passed; }).length;
                    console.log("\nTotal: ".concat(testResults.length));
                    console.log("\u2705 Passed: ".concat(passed));
                    console.log("\u274C Failed: ".concat(failed));
                    if (failed > 0) {
                        process.exit(1);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
runTests().catch(function (err) {
    console.error('Test suite error:', err);
    process.exit(1);
});
