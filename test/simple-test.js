"use strict";
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
var main_1 = require("../dist/main");
var async = __importStar(require("async"));
var domain = __importStar(require("domain"));
const testPort = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT) : 6970;
Promise.all([
    new main_1.Broker({ port: testPort }).ensure(),
    new main_1.Client({ port: testPort }).connect()
])
    .then(function (_a) {
    var b = _a[0], c = _a[1];
    b.emitter.on('warning', function (v) {
        if (!String(v).match(/no lock with key/)) {
            console.error.apply(console, __spreadArray(['broker warning:'], arguments, false));
        }
    });
    c.emitter.on('warning', function (v) {
        if (!String(v).match(/no lock with key/)) {
            console.error.apply(console, __spreadArray(['client warning:'], arguments, false));
        }
    });
    b.emitter.on('error', function (v) {
        if (!String(v).match(/no lock with key/)) {
            console.error.apply(console, __spreadArray(['broker error:'], arguments, false));
        }
    });
    c.emitter.on('error', function (v) {
        if (!String(v).match(/no lock with key/)) {
            console.error.apply(console, __spreadArray(['client error:'], arguments, false));
        }
    });
    var d = domain.create();
    d.once('error', function (err) {
        console.error('domain caught error:', err);
        process.exit(1);
    });
    d.run(function () {
        async.series([
            function (cb) {
                var c = main_1.Client.create();
                c.ensure(function (err, c) {
                    if (err) {
                        return cb(err);
                    }
                    debugger;
                    c.lock('z', function (err, v) {
                        if (err) {
                            return cb(err);
                        }
                        console.log('the error:', err);
                        console.log('the v:', v);
                        console.log('the id:', v.id);
                        c.unlock('z', v.id, function (err, v) {
                            debugger;
                            console.log(err, v);
                            cb(err, v);
                        });
                    });
                });
            },
            function (cb) {
                debugger;
                var c = new main_1.Client();
                c.ensure().then(function () {
                    debugger;
                    c.lock('z', function (err, _a) {
                        var id = _a.id;
                        debugger;
                        if (err)
                            return cb(err);
                        c.unlock('z', id, cb);
                    });
                });
            },
            function (cb) {
                debugger;
                var c = main_1.Client.create();
                c.ensure().then(function (c) {
                    c.lock('z', function (err, _a) {
                        var id = _a.id;
                        debugger;
                        if (err)
                            return cb(err);
                        c.unlock('z', id, cb);
                    });
                });
            },
            function (cb) {
                main_1.Client.create().ensure().then(function (c) {
                    debugger;
                    c.lockp('z').then(function (_a) {
                        var unlock = _a.unlock;
                        debugger;
                        if (unlock.acquired !== true) {
                            return Promise.reject('acquired was not true.');
                        }
                        debugger;
                        unlock(cb);
                    });
                });
            }
        ], function (err) {
            debugger;
            if (err) {
                console.error('final error:', err);
                process.exit(1);
            } else {
                console.log('all done.');
                process.exit(0);
            }
        });
    });
});
