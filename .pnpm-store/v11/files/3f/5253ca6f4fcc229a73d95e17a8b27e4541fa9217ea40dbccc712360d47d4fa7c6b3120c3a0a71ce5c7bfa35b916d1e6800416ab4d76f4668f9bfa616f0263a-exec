'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const sqlite3 = require('sqlite3').verbose();
const suman_events_1 = require("suman-events");
const utils_1 = require("../../lib/utils");
const reporterName = path.basename(__dirname);
const log = utils_1.getLogger(reporterName);
const p = path.resolve(process.env.HOME + '/.suman/global/node_modules/sqlite3');
const dbPth = path.resolve(process.env.HOME + '/.suman/db');
let db = new sqlite3.Database(dbPth, function (err) {
    if (err) {
        log.error(err);
    }
    else {
        log.veryGood(' => SQLite connected.');
    }
});
db.on('error', function (err) {
    log.error(' => sqlite error => ', err);
});
db.configure('busyTimeout', 4000);
const noop = function () {
};
exports.loadReporter = utils_1.wrapReporter(reporterName, (retContainer, results, s, sumanOpts, expectations) => {
    const runAsync = function (fn) {
        retContainer.ret.count++;
        fn(function (err) {
            err && log.error(err.stack || err);
            retContainer.ret.count--;
            if (retContainer.ret.count < 1) {
                retContainer.ret.cb();
            }
        });
    };
    const runPromise = function (promise) {
        retContainer.ret.count++;
        return promise
            .catch(err => err && log.error(err.stack || err))
            .then(function () {
            retContainer.ret.count--;
            retContainer.ret.count < 1 && retContainer.ret.cb();
        });
    };
    s.on(String(suman_events_1.events.FATAL_TEST_ERROR), function (val) {
        runAsync(function (cb) {
            db.serialize(function () {
                db.run('CREATE TABLE lorem (info TEXT)');
                let stmt = db.prepare('INSERT INTO lorem VALUES (?)');
                for (let i = 0; i < 10; i++) {
                    stmt.run('Ipsum ' + i);
                }
                stmt.finalize();
                db.all('SELECT rowid AS id, info FROM lorem', function (err, rows) {
                    log.info('rows count => ', rows.length);
                    cb();
                });
            });
        });
    });
    s.on(String(suman_events_1.events.TEST_CASE_END), function (val) {
        runAsync(function (cb) {
            db.serialize(function () {
                db.run('CREATE TABLE lorem (info TEXT)');
                let stmt = db.prepare('INSERT INTO lorem VALUES (?)');
                for (let i = 0; i < 1; i++) {
                    stmt.run('Ipsum ' + i);
                }
                stmt.finalize();
                db.all('SELECT rowid AS id, info FROM lorem', function (err, rows) {
                    log.info('rows count => ', rows.length);
                    cb();
                });
            });
        });
    });
    s.on(String(suman_events_1.events.TEST_CASE_PASS), function (val) {
        runAsync(function (cb) {
            db.serialize(function () {
                db.run('CREATE TABLE lorem (info TEXT)');
                let stmt = db.prepare('INSERT INTO lorem VALUES (?)');
                for (let i = 0; i < 1; i++) {
                    stmt.run('Ipsum ' + i);
                }
                stmt.finalize();
                db.all('SELECT rowid AS id, info FROM lorem', function (err, rows) {
                    log.info('rows count => ', rows.length);
                    cb();
                });
            });
        });
    });
    s.on(String(suman_events_1.events.TEST_CASE_SKIPPED), function (val) {
        runAsync(function (cb) {
            db.serialize(function () {
                db.run('CREATE TABLE lorem (info TEXT)');
                let stmt = db.prepare('INSERT INTO lorem VALUES (?)');
                for (let i = 0; i < 1; i++) {
                    stmt.run('Ipsum ' + i);
                }
                stmt.finalize();
                db.all('SELECT rowid AS id, info FROM lorem', function (err, rows) {
                    log.info('rows count => ', rows.length);
                    cb();
                });
            });
        });
    });
    s.on(String(suman_events_1.events.TEST_CASE_STUBBED), function (val) {
        runAsync(function (cb) {
            db.serialize(function () {
                db.run('CREATE TABLE lorem (info TEXT)');
                let stmt = db.prepare('INSERT INTO lorem VALUES (?)');
                for (let i = 0; i < 1; i++) {
                    stmt.run('Ipsum ' + i);
                }
                stmt.finalize();
                db.all('SELECT rowid AS id, info FROM lorem', function (err, rows) {
                    log.info('rows count => ', rows.length);
                    cb();
                });
            });
        });
    });
    return retContainer.ret = {
        results,
        reporterName,
        count: 0,
        cb: noop
    };
});
exports.default = exports.loadReporter;
