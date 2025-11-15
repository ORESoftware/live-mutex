#!/usr/bin/env node
/**
 * Test connection CLI tool - verify broker connectivity and basic operations
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
var main_1 = require("../../src/main");
var port = parseInt(process.env.lmx_port || process.env.LMX_PORT || '6970');
var host = process.env.lmx_host || process.env.LMX_HOST || 'localhost';
function testBasicLock() {
    return __awaiter(this, void 0, void 0, function () {
        var client, key, _a, acquiredKey, id, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Testing basic lock operations...');
                    client = new main_1.Client({ port: port, host: host });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, client.ensure()];
                case 2:
                    _b.sent();
                    console.log('  ✅ Connected to broker');
                    key = "test-".concat(Date.now());
                    return [4 /*yield*/, client.acquire(key, { lockRequestTimeout: 5000 })];
                case 3:
                    _a = _b.sent(), acquiredKey = _a.key, id = _a.id;
                    console.log("  \u2705 Acquired lock: key=\"".concat(acquiredKey, "\", id=\"").concat(id, "\""));
                    return [4 /*yield*/, client.release(acquiredKey, { id: id })];
                case 4:
                    _b.sent();
                    console.log("  \u2705 Released lock successfully");
                    client.close();
                    return [2 /*return*/, true];
                case 5:
                    err_1 = _b.sent();
                    console.error("  \u274C Failed: ".concat(err_1.message));
                    client.close();
                    return [2 /*return*/, false];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function testRWLock() {
    return __awaiter(this, void 0, void 0, function () {
        var client, key, releaseRead_1, releaseWrite_1, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Testing RW lock operations...');
                    client = new main_1.RWLockWritePrefClient({ port: port, host: host });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, client.ensure()];
                case 2:
                    _a.sent();
                    console.log('  ✅ Connected to broker');
                    key = "rw-test-".concat(Date.now());
                    return [4 /*yield*/, client.acquireReadLockp(key, { lockRequestTimeout: 5000 })];
                case 3:
                    releaseRead_1 = _a.sent();
                    console.log("  \u2705 Acquired read lock: key=\"".concat(key, "\""));
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            releaseRead_1(function (err) {
                                if (err)
                                    return reject(err);
                                resolve();
                            });
                        })];
                case 4:
                    _a.sent();
                    console.log("  \u2705 Released read lock successfully");
                    return [4 /*yield*/, client.acquireWriteLockp(key, { lockRequestTimeout: 5000 })];
                case 5:
                    releaseWrite_1 = _a.sent();
                    console.log("  \u2705 Acquired write lock: key=\"".concat(key, "\""));
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            releaseWrite_1(function (err) {
                                if (err)
                                    return reject(err);
                                resolve();
                            });
                        })];
                case 6:
                    _a.sent();
                    console.log("  \u2705 Released write lock successfully");
                    client.close();
                    return [2 /*return*/, true];
                case 7:
                    err_2 = _a.sent();
                    console.error("  \u274C Failed: ".concat(err_2.message));
                    client.close();
                    return [2 /*return*/, false];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, testType, allPassed, passed, passed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    args = process.argv.slice(2);
                    testType = args[0] || 'all';
                    console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
                    console.log("\u2551           Live-Mutex Connection Test                            \u2551");
                    console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n");
                    console.log("Testing connection to broker at ".concat(host, ":").concat(port, "\n"));
                    allPassed = true;
                    if (!(testType === 'all' || testType === 'basic')) return [3 /*break*/, 2];
                    return [4 /*yield*/, testBasicLock()];
                case 1:
                    passed = _a.sent();
                    if (!passed)
                        allPassed = false;
                    console.log('');
                    _a.label = 2;
                case 2:
                    if (!(testType === 'all' || testType === 'rw')) return [3 /*break*/, 4];
                    return [4 /*yield*/, testRWLock()];
                case 3:
                    passed = _a.sent();
                    if (!passed)
                        allPassed = false;
                    console.log('');
                    _a.label = 4;
                case 4:
                    if (allPassed) {
                        console.log('✅ All connection tests passed!\n');
                        process.exit(0);
                    }
                    else {
                        console.log('❌ Some tests failed. Check broker is running.\n');
                        process.exit(1);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('Error:', err);
    process.exit(1);
});
