"use strict";
exports.__esModule = true;
var live_mutex_1 = require("live-mutex");
var async = require("async");
var domain = require("domain");
Promise.all([
    new live_mutex_1.Broker().ensure(),
    new live_mutex_1.Client().connect()
])
    .then(function (_a) {
    var b = _a[0], c = _a[1];
    b.emitter.on('warning', function (v) {
        if (!String(v).match(/no lock with key/)) {
            console.error.apply(console, ['broker warning:'].concat(arguments));
        }
    });
    c.emitter.on('warning', function (v) {
        if (!String(v).match(/no lock with key/)) {
            console.error.apply(console, ['client warning:'].concat(arguments));
        }
    });
    b.emitter.on('error', function (v) {
        if (!String(v).match(/no lock with key/)) {
            console.error.apply(console, ['broker error:'].concat(arguments));
        }
    });
    c.emitter.on('error', function (v) {
        if (!String(v).match(/no lock with key/)) {
            console.error.apply(console, ['client error:'].concat(arguments));
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
                var c = live_mutex_1.Client.create();
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
                var c = new live_mutex_1.Client();
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
                var c = live_mutex_1.Client.create();
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
                live_mutex_1.Client.create().ensure().then(function (c) {
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
            }
            console.log('all done.');
        });
    });
});
