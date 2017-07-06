'use strict';
var suman = require('suman');
var Test = suman.init(module);
var colors = require('colors/safe');
Test.create(function (it, Broker, Client, inject, describe, before) {
    var conf = Object.freeze({ port: 7034 });
    inject(function () {
        return {
            broker: new Broker(conf).ensure()
        };
    });
    var c;
    before('get client', function (h) {
        return new Client(conf).ensure().then(function (client) {
            c = client;
        });
    });
    describe('injected', function () {
        it.cb('locks/unlocks', function (t) {
            c.lock('a', {}, function (err, unlock) {
                if (err) {
                    return t.fail(err);
                }
                console.log('\n', colors.yellow(' ONE lock acquired!!! => '), '\n');
                setTimeout(function () {
                    unlock(function (err) {
                        if (err) {
                            return t.fail(err);
                        }
                        else {
                            console.log(colors.yellow(' ONE lock released!!! => '));
                            t.done();
                        }
                    });
                }, 1500);
            });
        });
        it.cb('locks/unlocks', function (t) {
            c.lock('a', 1100, function (err, unlock, id) {
                if (err) {
                    return t.fail(err);
                }
                console.log('\n', colors.blue(' TWO lock acquired!!! => '), '\n', id);
                setTimeout(function () {
                    c.unlock('a', id, function (err) {
                        if (err) {
                            return t.fail(err);
                        }
                        else {
                            console.log(colors.blue(' TWO lock released!!! => '));
                            t.done();
                        }
                    });
                }, 1000);
            });
        });
        it.cb('locks/unlocks', function (t) {
            c.lock('a', {}, function (err, unlock, id) {
                if (err) {
                    return t.fail(err);
                }
                console.log('\n', colors.green(' THREE lock acquired!!! => '), '\n', id);
                setTimeout(function () {
                    c.unlock('a', function (err) {
                        if (err) {
                            t.fail(err);
                        }
                        else {
                            console.log(colors.green(' THREE lock released!!! => '));
                            t.done();
                        }
                    });
                }, 1000);
            });
        });
    });
});
