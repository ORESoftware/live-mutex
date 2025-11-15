'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const suman = require("suman");
const { Test } = suman.init(module);
const main_1 = require("../../dist/main");
Test.create(['Promise', function (b, it, inject, describe, before, $deps) {
        console.log('suman child id:', process.env.SUMAN_CHILD_ID);
        return;
        const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
        const conf = Object.freeze({ port });
        const writeKey = 'write-key';
        const handleEvents = function (v) {
            v.emitter.on('warning', w => {
                console.error('warning:', w);
            });
            v.emitter.on('error', w => {
                console.error('error:', w);
            });
            return v;
        };
        inject(() => {
            const brokerConf = Object.assign({}, conf, { noListen: process.env.lmx_broker_no_listen === 'yes' });
            return {
                broker: new main_1.Broker1(brokerConf).ensure().then(handleEvents)
            };
        });
        before('get client', h => {
            return new main_1.RWLockClient(conf).ensure().then(function (client) {
                h.supply.client = handleEvents(client);
            });
        });
        describe('injected', function (b) {
            it.cb('locks/unlocks', t => {
                const c = t.supply.client;
                c.beginRead('a', { writeKey }, function (err, v) {
                    console.error('here is args 1:,', err, v);
                    if (err) {
                        return t.fail(err);
                    }
                    setTimeout(function () {
                        c.endRead('a', { writeKey }, (err, val) => {
                            console.error('here is args 2:,', err, val);
                            if (err.match(/no lock with key/)) {
                                err = null;
                            }
                            t.done(err);
                        });
                    }, 1500);
                });
            });
        });
    }]);
