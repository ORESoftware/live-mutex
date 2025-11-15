#!/usr/bin/env node
/**
 * Status CLI tool - check broker status and connection info
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
var net = require("net");
var main_1 = require("../../src/main");
var port = parseInt(process.env.lmx_port || process.env.LMX_PORT || '6970');
var host = process.env.lmx_host || process.env.LMX_HOST || 'localhost';
function checkPort(port, host) {
    return new Promise(function (resolve) {
        var socket = new net.Socket();
        var timeout = 2000;
        socket.setTimeout(timeout);
        socket.once('connect', function () {
            socket.destroy();
            resolve(true);
        });
        socket.once('timeout', function () {
            socket.destroy();
            resolve(false);
        });
        socket.once('error', function () {
            resolve(false);
        });
        socket.connect(port, host);
    });
}
function getBrokerInfo() {
    return __awaiter(this, void 0, void 0, function () {
        var client, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = new main_1.Client({ port: port, host: host });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.ensure()];
                case 2:
                    _a.sent();
                    // Try to inspect the broker
                    return [2 /*return*/, new Promise(function (resolve, reject) {
                            var timeout = setTimeout(function () {
                                client.close();
                                reject(new Error('Timeout waiting for broker response'));
                            }, 5000);
                            // Use inspect if available, otherwise just return basic info
                            resolve({
                                connected: true,
                                port: port,
                                host: host
                            });
                        })];
                case 3:
                    err_1 = _a.sent();
                    return [2 /*return*/, {
                            connected: false,
                            error: err_1.message,
                            port: port,
                            host: host
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var portOpen, info, client, testKey, _a, key, id, err_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
                    console.log("\u2551           Live-Mutex Broker Status                              \u2551");
                    console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n");
                    console.log("Checking broker at ".concat(host, ":").concat(port, "...\n"));
                    return [4 /*yield*/, checkPort(port, host)];
                case 1:
                    portOpen = _b.sent();
                    if (!portOpen) {
                        console.log("\u274C Broker Status: NOT RUNNING");
                        console.log("   Port ".concat(port, " on ").concat(host, " is not accessible\n"));
                        console.log("To start a broker:");
                        console.log("  $ lmx-quick-start start");
                        console.log("  $ lmx start");
                        console.log("  $ docker run -d -p ".concat(port, ":").concat(port, " oresoftware/live-mutex-broker:latest\n"));
                        process.exit(1);
                    }
                    console.log("\u2705 Port ".concat(port, " is open"));
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 9, , 10]);
                    return [4 /*yield*/, getBrokerInfo()];
                case 3:
                    info = _b.sent();
                    if (!info.connected) return [3 /*break*/, 7];
                    console.log("\u2705 Successfully connected to broker");
                    console.log("\nBroker Information:");
                    console.log("  Host: ".concat(info.host));
                    console.log("  Port: ".concat(info.port));
                    console.log("  Status: RUNNING\n");
                    client = new main_1.Client({ port: port, host: host });
                    return [4 /*yield*/, client.ensure()];
                case 4:
                    _b.sent();
                    testKey = "status-check-".concat(Date.now());
                    return [4 /*yield*/, client.acquire(testKey, { lockRequestTimeout: 2000 })];
                case 5:
                    _a = _b.sent(), key = _a.key, id = _a.id;
                    return [4 /*yield*/, client.release(key, { id: id })];
                case 6:
                    _b.sent();
                    client.close();
                    console.log("\u2705 Lock test: PASSED");
                    console.log("\nBroker is fully operational! \uD83C\uDF89\n");
                    process.exit(0);
                    return [3 /*break*/, 8];
                case 7:
                    console.log("\u26A0\uFE0F  Port is open but broker may not be responding correctly");
                    console.log("   Error: ".concat(info.error, "\n"));
                    process.exit(1);
                    _b.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    err_2 = _b.sent();
                    console.log("\u26A0\uFE0F  Port is open but connection test failed");
                    console.log("   Error: ".concat(err_2.message, "\n"));
                    process.exit(1);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('Error:', err);
    process.exit(1);
});
