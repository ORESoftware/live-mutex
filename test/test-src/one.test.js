'use strict';


const suman = require('suman');
const Test = suman.init(module);


const colors = require('colors/safe');


Test.create(__filename, {}, function (it, Broker, Client) {

    const broker = new Broker({port: 7033});


    const client = new Client({port: 7033});

    it.cb('locks/unlocks', t => {

        client.lock('a', {}, function (err, unlock) {

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


    it.cb('locks/unlocks', t => {

        client.lock('a', 10, function (err, unlock, id) {

            if (err) {
                return t.fail(err);
            }

            console.log('\n', colors.blue(' TWO lock acquired!!! => '), '\n', id);

            setTimeout(function () {

                client.unlock('a', id, function (err) {
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


    it.cb('locks/unlocks', t => {


        client.lock('a', {}, function (err, unlock, id) {

            if (err) {
                return t.fail(err);
            }

            console.log('\n', colors.green(' THREE lock acquired!!! => '), '\n', id);

            setTimeout(function () {
                client.unlock('a', function (err) {
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
