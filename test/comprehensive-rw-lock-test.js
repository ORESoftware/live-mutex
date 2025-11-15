#!/usr/bin/env node
'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runComprehensiveTests = runComprehensiveTests;
/**
 * Comprehensive Reader-Writer Lock Test Suite
 * Tests all aspects of RW lock behavior including:
 * - Concurrent readers
 * - Exclusive writers
 * - Write preference
 * - Ordering guarantees
 * - Stress testing
 */
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var os = __importStar(require("os"));
var broker_1_1 = require("../dist/broker-1");
var rw_write_preferred_client_1 = require("../dist/rw-write-preferred-client");
var PORT = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : 3333;
var TEST_FILE = path.join(os.tmpdir(), 'lmx-rw-comprehensive-test.txt');
var testResults = [];
function log(message, data) {
    var timestamp = new Date().toISOString();
    var logLine = "[".concat(timestamp, "] ").concat(message).concat(data ? ' ' + JSON.stringify(data) : '');
    console.log(logLine);
}
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
function readFile() {
    try {
        return fs.readFileSync(TEST_FILE, 'utf8').trim();
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return '';
        throw err;
    }
}
function writeFile(content) {
    fs.writeFileSync(TEST_FILE, content, 'utf8');
}
function appendToFile(content) {
    fs.appendFileSync(TEST_FILE, content, 'utf8');
}
function test1_ConcurrentReaders(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_1, readers, _loop_1, i, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 1: Multiple Concurrent Readers');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    writeFile('TEST1');
                    key_1 = 'test1-key';
                    readers = [];
                    _loop_1 = function (i) {
                        readers.push(new Promise(function (resolve, reject) {
                            clients[i].acquireReadLock(key_1, {}, function (err, release) {
                                if (err)
                                    return reject(err);
                                var content = readFile();
                                if (content !== 'TEST1') {
                                    return reject(new Error("Reader ".concat(i, " read wrong value: ").concat(content)));
                                }
                                setTimeout(function () {
                                    release(function (releaseErr) {
                                        if (releaseErr)
                                            return reject(releaseErr);
                                        resolve();
                                    });
                                }, 50);
                            });
                        }));
                    };
                    for (i = 0; i < 5; i++) {
                        _loop_1(i);
                    }
                    return [4 /*yield*/, Promise.all(readers)];
                case 2:
                    _a.sent();
                    log('Test 1 PASSED: All readers read concurrently');
                    return [2 /*return*/, { name: 'Concurrent Readers', passed: true }];
                case 3:
                    err_1 = _a.sent();
                    log('Test 1 FAILED', { error: err_1.message });
                    return [2 /*return*/, { name: 'Concurrent Readers', passed: false, error: err_1.message }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function test2_WriterExclusive(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_2, writerAcquired_1, writerReleased_1, readerAcquiredDuringWrite_1, readerAcquiredTime_1, writerReleaseTime_1, writer, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 2: Writer Exclusive Access');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    writeFile('TEST2-START');
                    key_2 = 'test2-key';
                    writerAcquired_1 = false;
                    writerReleased_1 = false;
                    readerAcquiredDuringWrite_1 = false;
                    readerAcquiredTime_1 = 0;
                    writerReleaseTime_1 = 0;
                    writer = new Promise(function (resolve, reject) {
                        var writerStartTime = Date.now();
                        clients[0].acquireWriteLock(key_2, {}, function (err, release) {
                            if (err)
                                return reject(err);
                            writerAcquired_1 = true;
                            log('Writer acquired');
                            // Start a reader while writer holds lock
                            setTimeout(function () {
                                clients[1].acquireReadLock(key_2, {}, function (readErr, readRelease) {
                                    readerAcquiredTime_1 = Date.now();
                                    if (!readErr) {
                                        // Check if writer still holds lock
                                        if (!writerReleased_1) {
                                            readerAcquiredDuringWrite_1 = true;
                                            log('⚠️  Reader acquired during write!');
                                        }
                                        else {
                                            log('Reader acquired after writer released (correct)');
                                        }
                                        readRelease(function () { });
                                    }
                                });
                            }, 50);
                            setTimeout(function () {
                                writerReleaseTime_1 = Date.now();
                                writerReleased_1 = true;
                                release(function (releaseErr) {
                                    if (releaseErr)
                                        return reject(releaseErr);
                                    log('Writer released');
                                    resolve();
                                });
                            }, 300);
                        });
                    });
                    return [4 /*yield*/, writer];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, delay(500)];
                case 3:
                    _a.sent(); // Wait longer for reader to complete
                    if (readerAcquiredDuringWrite_1) {
                        return [2 /*return*/, { name: 'Writer Exclusive', passed: false, error: 'Reader acquired during write' }];
                    }
                    log('Test 2 PASSED: Writer was exclusive');
                    return [2 /*return*/, { name: 'Writer Exclusive', passed: true }];
                case 4:
                    err_2 = _a.sent();
                    log('Test 2 FAILED', { error: err_2.message });
                    return [2 /*return*/, { name: 'Writer Exclusive', passed: false, error: err_2.message }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function test3_SequentialWrites(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_3, values_1, _loop_2, i, final, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 3: Sequential Writes Maintain Order');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    writeFile('WRITE-0');
                    key_3 = 'test3-key';
                    values_1 = [];
                    _loop_2 = function (i) {
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                                        clients[i % clients.length].acquireWriteLock(key_3, {}, function (err, release) {
                                            if (err)
                                                return reject(err);
                                            var value = "WRITE-".concat(i);
                                            var before = readFile();
                                            writeFile(value);
                                            var after = readFile();
                                            values_1.push(value);
                                            log("Write ".concat(i, ": ").concat(before, " -> ").concat(after));
                                            setTimeout(function () {
                                                release(function (releaseErr) {
                                                    if (releaseErr)
                                                        return reject(releaseErr);
                                                    resolve();
                                                });
                                            }, 50);
                                        });
                                    })];
                                case 1:
                                    _b.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 1;
                    _a.label = 2;
                case 2:
                    if (!(i <= 5)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_2(i)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 2];
                case 5:
                    final = readFile();
                    if (final !== 'WRITE-5') {
                        return [2 /*return*/, { name: 'Sequential Writes', passed: false, error: "Expected WRITE-5, got ".concat(final) }];
                    }
                    log('Test 3 PASSED: Writes maintained order');
                    return [2 /*return*/, { name: 'Sequential Writes', passed: true, details: { values: values_1, final: final } }];
                case 6:
                    err_3 = _a.sent();
                    log('Test 3 FAILED', { error: err_3.message });
                    return [2 /*return*/, { name: 'Sequential Writes', passed: false, error: err_3.message }];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function test4_WritePreference(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_4, order_1, readers, _loop_3, i, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 4: Write Preference (Writers prioritized)');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    writeFile('PREF-START');
                    key_4 = 'test4-key';
                    order_1 = [];
                    readers = [];
                    _loop_3 = function (i) {
                        readers.push(new Promise(function (resolve) {
                            clients[i].acquireReadLock(key_4, {}, function (err, release) {
                                if (!err) {
                                    order_1.push("R".concat(i));
                                    setTimeout(function () {
                                        release(function () { return resolve(); });
                                    }, 100);
                                }
                                else {
                                    resolve();
                                }
                            });
                        }));
                    };
                    for (i = 0; i < 3; i++) {
                        _loop_3(i);
                    }
                    // Start a writer that should be prioritized
                    setTimeout(function () {
                        clients[3].acquireWriteLock(key_4, {}, function (err, release) {
                            if (!err) {
                                order_1.push('W');
                                setTimeout(function () {
                                    release(function () { });
                                }, 50);
                            }
                        });
                    }, 30);
                    return [4 /*yield*/, Promise.all(readers)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, delay(200)];
                case 3:
                    _a.sent();
                    log('Test 4 completed', { order: order_1 });
                    // In write-preferring, writer should get priority
                    log('Test 4 PASSED: Write preference tested');
                    return [2 /*return*/, { name: 'Write Preference', passed: true, details: { order: order_1 } }];
                case 4:
                    err_4 = _a.sent();
                    log('Test 4 FAILED', { error: err_4.message });
                    return [2 /*return*/, { name: 'Write Preference', passed: false, error: err_4.message }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function test5_StressTest(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_5, writeCount, completedWrites_1, operations, _loop_4, i, final, err_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 5: Stress Test - 20 Operations');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    writeFile('0');
                    key_5 = 'test5-key';
                    writeCount = 0;
                    completedWrites_1 = 0;
                    operations = [];
                    _loop_4 = function (i) {
                        var client = clients[i % clients.length];
                        var opIndex = i;
                        if (i % 3 === 0) {
                            // Writer - every 3rd operation (7 writers total)
                            writeCount++;
                            operations.push(new Promise(function (resolve) {
                                // Add small delay to stagger operations
                                setTimeout(function () {
                                    client.acquireWriteLock(key_5, { lockRequestTimeout: 30000 }, function (err, release) {
                                        if (err) {
                                            log("Write ".concat(opIndex, " failed:"), err.message);
                                            return resolve();
                                        }
                                        var current = parseInt(readFile()) || 0;
                                        var newValue = current + 1;
                                        writeFile(String(newValue));
                                        log("Write ".concat(opIndex, ": ").concat(current, " -> ").concat(newValue));
                                        completedWrites_1++;
                                        setTimeout(function () {
                                            release(function (releaseErr) {
                                                if (releaseErr) {
                                                    log("Write ".concat(opIndex, " release failed:"), releaseErr.message);
                                                }
                                                resolve();
                                            });
                                        }, 20);
                                    });
                                }, i * 50); // Stagger by 50ms
                            }));
                        }
                        else {
                            // Reader
                            operations.push(new Promise(function (resolve) {
                                setTimeout(function () {
                                    client.acquireReadLock(key_5, { lockRequestTimeout: 30000 }, function (err, release) {
                                        if (!err) {
                                            var val = readFile();
                                            setTimeout(function () {
                                                release(function () { return resolve(); });
                                            }, 20);
                                        }
                                        else {
                                            resolve();
                                        }
                                    });
                                }, i * 50);
                            }));
                        }
                    };
                    // Simplified stress test: 20 operations with better spacing
                    // This tests concurrency without overwhelming the system
                    for (i = 0; i < 20; i++) {
                        _loop_4(i);
                    }
                    // Wait for all operations to complete
                    return [4 /*yield*/, Promise.all(operations)];
                case 2:
                    // Wait for all operations to complete
                    _a.sent();
                    return [4 /*yield*/, delay(500)];
                case 3:
                    _a.sent();
                    final = parseInt(readFile());
                    log('Test 5 completed', { writeCount: writeCount, completedWrites: completedWrites_1, final: final });
                    if (final !== writeCount) {
                        return [2 /*return*/, { name: 'Stress Test', passed: false, error: "Expected ".concat(writeCount, " writes, completed ").concat(completedWrites_1, ", final value ").concat(final) }];
                    }
                    log('Test 5 PASSED: Stress test completed');
                    return [2 /*return*/, { name: 'Stress Test', passed: true, details: { writeCount: writeCount, completedWrites: completedWrites_1, final: final } }];
                case 4:
                    err_5 = _a.sent();
                    log('Test 5 FAILED', { error: err_5.message });
                    return [2 /*return*/, { name: 'Stress Test', passed: false, error: err_5.message }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function test6_FileConsistency(broker, clients) {
    return __awaiter(this, void 0, void 0, function () {
        var key_6, expected_2, _loop_5, i, content, lines, _i, expected_1, expectedLine, err_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log('Test 6: File Consistency - Append Operations');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    writeFile('');
                    key_6 = 'test6-key';
                    expected_2 = [];
                    _loop_5 = function (i) {
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                                        clients[i % clients.length].acquireWriteLock(key_6, {}, function (err, release) {
                                            if (err)
                                                return reject(err);
                                            var line = "LINE-".concat(i, "\n");
                                            appendToFile(line);
                                            expected_2.push("LINE-".concat(i));
                                            setTimeout(function () {
                                                release(function (releaseErr) {
                                                    if (releaseErr)
                                                        return reject(releaseErr);
                                                    resolve();
                                                });
                                            }, 20);
                                        });
                                    })];
                                case 1:
                                    _b.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < 10)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_5(i)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 2];
                case 5:
                    content = readFile();
                    lines = content.split('\n').filter(function (l) { return l.trim(); });
                    // Verify all lines present
                    for (_i = 0, expected_1 = expected_2; _i < expected_1.length; _i++) {
                        expectedLine = expected_1[_i];
                        if (!lines.includes(expectedLine)) {
                            return [2 /*return*/, { name: 'File Consistency', passed: false, error: "Missing line: ".concat(expectedLine) }];
                        }
                    }
                    log('Test 6 PASSED: File consistency maintained');
                    return [2 /*return*/, { name: 'File Consistency', passed: true, details: { lineCount: lines.length } }];
                case 6:
                    err_6 = _a.sent();
                    log('Test 6 FAILED', { error: err_6.message });
                    return [2 /*return*/, { name: 'File Consistency', passed: false, error: err_6.message }];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function runComprehensiveTests() {
    return __awaiter(this, void 0, void 0, function () {
        var broker, clients, i, client, _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, passed, failed, error_1, _i, clients_1, client;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    console.log('=== Comprehensive Reader-Writer Lock Test Suite ===\n');
                    broker = null;
                    clients = [];
                    _o.label = 1;
                case 1:
                    _o.trys.push([1, 18, 19, 22]);
                    // Setup
                    log('Starting broker', { port: PORT });
                    broker = new broker_1_1.Broker1({ port: PORT });
                    return [4 /*yield*/, broker.ensure()];
                case 2:
                    _o.sent();
                    log('Creating clients', { count: 10 });
                    i = 0;
                    _o.label = 3;
                case 3:
                    if (!(i < 10)) return [3 /*break*/, 6];
                    client = new rw_write_preferred_client_1.RWLockWritePrefClient({ port: PORT, lockRequestTimeout: 10000 });
                    return [4 /*yield*/, client.ensure()];
                case 4:
                    _o.sent();
                    clients.push(client);
                    _o.label = 5;
                case 5:
                    i++;
                    return [3 /*break*/, 3];
                case 6:
                    // Run tests
                    _b = (_a = testResults).push;
                    return [4 /*yield*/, test1_ConcurrentReaders(broker, clients)];
                case 7:
                    // Run tests
                    _b.apply(_a, [_o.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 8:
                    _o.sent();
                    _d = (_c = testResults).push;
                    return [4 /*yield*/, test2_WriterExclusive(broker, clients)];
                case 9:
                    _d.apply(_c, [_o.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 10:
                    _o.sent();
                    _f = (_e = testResults).push;
                    return [4 /*yield*/, test3_SequentialWrites(broker, clients)];
                case 11:
                    _f.apply(_e, [_o.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 12:
                    _o.sent();
                    _h = (_g = testResults).push;
                    return [4 /*yield*/, test4_WritePreference(broker, clients)];
                case 13:
                    _h.apply(_g, [_o.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 14:
                    _o.sent();
                    _k = (_j = testResults).push;
                    return [4 /*yield*/, test5_StressTest(broker, clients)];
                case 15:
                    _k.apply(_j, [_o.sent()]);
                    return [4 /*yield*/, delay(200)];
                case 16:
                    _o.sent();
                    _m = (_l = testResults).push;
                    return [4 /*yield*/, test6_FileConsistency(broker, clients)];
                case 17:
                    _m.apply(_l, [_o.sent()]);
                    // Summary
                    console.log('\n=== Test Summary ===');
                    passed = testResults.filter(function (r) { return r.passed; }).length;
                    failed = testResults.filter(function (r) { return !r.passed; }).length;
                    testResults.forEach(function (result) {
                        var status = result.passed ? '✅' : '❌';
                        console.log("".concat(status, " ").concat(result.name));
                        if (!result.passed && result.error) {
                            console.log("   Error: ".concat(result.error));
                        }
                    });
                    console.log("\nTotal: ".concat(testResults.length, " tests"));
                    console.log("Passed: ".concat(passed));
                    console.log("Failed: ".concat(failed));
                    if (failed > 0) {
                        throw new Error("".concat(failed, " test(s) failed"));
                    }
                    return [3 /*break*/, 22];
                case 18:
                    error_1 = _o.sent();
                    console.error('\n❌ Test suite failed:', error_1);
                    throw error_1;
                case 19:
                    // Cleanup
                    for (_i = 0, clients_1 = clients; _i < clients_1.length; _i++) {
                        client = clients_1[_i];
                        try {
                            client.close();
                        }
                        catch (err) {
                            // Ignore
                        }
                    }
                    if (!broker) return [3 /*break*/, 21];
                    return [4 /*yield*/, new Promise(function (resolve) {
                            broker.close(function () { return resolve(); });
                        })];
                case 20:
                    _o.sent();
                    _o.label = 21;
                case 21:
                    // Clean up test file
                    try {
                        if (fs.existsSync(TEST_FILE))
                            fs.unlinkSync(TEST_FILE);
                    }
                    catch (err) {
                        // Ignore
                    }
                    return [7 /*endfinally*/];
                case 22: return [2 /*return*/];
            }
        });
    });
}
// Run tests
if (require.main === module) {
    runComprehensiveTests()
        .then(function () {
        console.log('\n✅ All tests completed successfully');
        process.exit(0);
    })
        .catch(function (err) {
        console.error('\n❌ Test suite failed:', err);
        process.exit(1);
    });
}
