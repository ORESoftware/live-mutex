'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const async = require("async");
const live_mutex_1 = require("live-mutex");
const path = require('path');
const conf = Object.freeze({ udsPath: path.resolve(process.env.HOME + '/uds_live_mutex') });
process.on('unhandledRejection', function (e) {
    console.error('unhandledRejection => ', e.stack || e);
});
Promise.all([
    ((() => {
        return new live_mutex_1.Broker(conf).ensure();
    })()),
    new live_mutex_1.Client(conf).ensure()
])
    .then(function ([b, c]) {
    b.emitter.on('warning', function () {
        console.log(...arguments);
    });
    c.emitter.on('warning', function () {
        console.log(...arguments);
    });
    const times = 10000, start = Date.now();
    async.timesLimit(times, 25, async (val) => {
        const { id, key } = await c.acquire('foo');
        return await c.release(key, id);
    }, function complete(err) {
        if (err) {
            throw err;
        }
        const diff = Date.now() - start;
        console.log(' => Time required for live-mutex => ', diff);
        console.log(' => Lock/unlock cycles per millisecond => ', Number(times / diff).toFixed(3));
        process.exit(0);
    });
});
