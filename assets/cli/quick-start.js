#!/usr/bin/env node
/**
 * Quick start CLI tool - helps users get started with live-mutex
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
        var timeout = 1000;
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
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, command, isRunning, broker_1, isRunning, Client, client, testKey, _a, key, id, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    args = process.argv.slice(2);
                    command = args[0];
                    if (!command || command === 'help' || command === '--help' || command === '-h') {
                        console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551           Live-Mutex Quick Start Guide                         \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\nUsage: lmx-quick-start <command>\n\nCommands:\n  check          Check if broker is running on default port (".concat(port, ")\n  start          Start a broker on default port (").concat(port, ")\n  test           Test acquiring and releasing a lock\n  docker         Show Docker commands to get started\n  examples       Show code examples\n\nExamples:\n  $ lmx-quick-start check\n  $ lmx-quick-start start\n  $ lmx-quick-start test\n  $ lmx-quick-start docker\n  $ lmx-quick-start examples\n\nEnvironment Variables:\n  LMX_PORT       Broker port (default: ").concat(port, ")\n  LMX_HOST       Broker host (default: ").concat(host, ")\n"));
                        process.exit(0);
                    }
                    if (!(command === 'check')) return [3 /*break*/, 2];
                    console.log("Checking if broker is running on ".concat(host, ":").concat(port, "..."));
                    return [4 /*yield*/, checkPort(port, host)];
                case 1:
                    isRunning = _b.sent();
                    if (isRunning) {
                        console.log("\u2705 Broker is running on ".concat(host, ":").concat(port));
                        process.exit(0);
                    }
                    else {
                        console.log("\u274C No broker found on ".concat(host, ":").concat(port));
                        console.log("\nStart a broker with: lmx-quick-start start");
                        console.log("Or use Docker: lmx-quick-start docker");
                        process.exit(1);
                    }
                    _b.label = 2;
                case 2:
                    if (command === 'start') {
                        console.log("Starting broker on ".concat(host, ":").concat(port, "..."));
                        console.log("Press Ctrl+C to stop\n");
                        broker_1 = new main_1.Broker1({ port: port, host: host });
                        broker_1.ensure().then(function () {
                            console.log("\u2705 Broker started successfully on ".concat(host, ":").concat(port));
                            console.log("\nYou can now use clients to connect to this broker.");
                            console.log("Test it with: lmx-quick-start test\n");
                        }).catch(function (err) {
                            console.error("\u274C Failed to start broker:", err.message);
                            process.exit(1);
                        });
                        // Handle graceful shutdown
                        process.on('SIGINT', function () {
                            console.log('\n\nShutting down broker...');
                            broker_1.close(function () {
                                console.log('✅ Broker stopped');
                                process.exit(0);
                            });
                        });
                    }
                    if (!(command === 'test')) return [3 /*break*/, 11];
                    console.log("Testing connection to broker at ".concat(host, ":").concat(port, "..."));
                    return [4 /*yield*/, checkPort(port, host)];
                case 3:
                    isRunning = _b.sent();
                    if (!isRunning) {
                        console.log("\u274C Broker is not running on ".concat(host, ":").concat(port));
                        console.log("\nStart a broker first with: lmx-quick-start start");
                        process.exit(1);
                    }
                    console.log("\u2705 Broker is running, testing lock acquisition...");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../../src/main'); })];
                case 4:
                    Client = (_b.sent()).Client;
                    client = new Client({ port: port, host: host });
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 10, , 11]);
                    return [4 /*yield*/, client.ensure()];
                case 6:
                    _b.sent();
                    console.log("\u2705 Connected to broker");
                    testKey = 'quick-start-test';
                    console.log("Acquiring lock on key \"".concat(testKey, "\"..."));
                    return [4 /*yield*/, client.acquire(testKey)];
                case 7:
                    _a = _b.sent(), key = _a.key, id = _a.id;
                    console.log("\u2705 Lock acquired: key=\"".concat(key, "\", id=\"").concat(id, "\""));
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                case 8:
                    _b.sent();
                    return [4 /*yield*/, client.release(key, { id: id })];
                case 9:
                    _b.sent();
                    console.log("\u2705 Lock released successfully");
                    client.close();
                    console.log("\n\u2705 All tests passed! Live-Mutex is working correctly.");
                    process.exit(0);
                    return [3 /*break*/, 11];
                case 10:
                    err_1 = _b.sent();
                    console.error("\u274C Test failed:", err_1.message);
                    client.close();
                    process.exit(1);
                    return [3 /*break*/, 11];
                case 11:
                    if (command === 'docker') {
                        console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551           Docker Quick Start Commands                          \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\n1. Pull the Docker image:\n   $ docker pull oresoftware/live-mutex-broker:latest\n\n2. Run the broker container:\n   $ docker run -d -p 6970:6970 --name lmx-broker oresoftware/live-mutex-broker:latest\n\n3. View broker logs:\n   $ docker logs -f lmx-broker\n\n4. Stop the broker:\n   $ docker stop lmx-broker\n\n5. Remove the container:\n   $ docker rm lmx-broker\n\n6. Run interactively (for testing):\n   $ docker run -it -p 6970:6970 oresoftware/live-mutex-broker:latest\n\nAfter starting the broker, test it with:\n   $ lmx-quick-start test\n");
                        process.exit(0);
                    }
                    if (command === 'examples') {
                        console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551           Code Examples                                        \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\nTypeScript/JavaScript Example:\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nimport {Client} from 'live-mutex';\n\nconst client = new Client({port: 6970, host: 'localhost'});\n\nasync function example() {\n  await client.ensure();\n  \n  const {key, id} = await client.acquire('my-lock-key');\n  try {\n    // Your critical section code here\n    console.log('Lock acquired, doing work...');\n  } finally {\n    await client.release(key, id);\n  }\n}\n\nexample().catch(console.error);\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nCallback Style Example:\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nimport {Client} from 'live-mutex';\n\nconst client = new Client({port: 6970, host: 'localhost'});\n\nclient.ensure((err, c) => {\n  if (err) return console.error(err);\n  \n  c.acquire('my-lock-key', (err, {key, id}) => {\n    if (err) return console.error(err);\n    \n    // Your critical section code here\n    console.log('Lock acquired, doing work...');\n    \n    c.release(key, id, (err) => {\n      if (err) return console.error(err);\n      console.log('Lock released');\n    });\n  });\n});\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nRead-Write Lock Example:\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nimport {RWLockWritePrefClient} from 'live-mutex';\n\nconst client = new RWLockWritePrefClient({port: 6970, host: 'localhost'});\n\nasync function example() {\n  await client.ensure();\n  \n  // Acquire read lock (multiple readers can coexist)\n  const releaseRead = await client.acquireReadLock('my-key');\n  try {\n    // Read operations\n  } finally {\n    await releaseRead();\n  }\n  \n  // Acquire write lock (exclusive)\n  const releaseWrite = await client.acquireWriteLock('my-key');\n  try {\n    // Write operations\n  } finally {\n    await releaseWrite();\n  }\n}\n\nexample().catch(console.error);\n");
                        process.exit(0);
                    }
                    console.error("Unknown command: ".concat(command));
                    console.error("Run 'lmx-quick-start help' for usage information");
                    process.exit(1);
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('Error:', err);
    process.exit(1);
});
