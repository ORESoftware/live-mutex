'use strict';

const Client = require('../client');
const colors = require('colors/safe');

const Broker = require('../broker');
const broker = new Broker({port: 7003});
const client = new Client({port: 7003});


const suman = require('suman');
const Test = suman.init(module);

Test.create(__filename, {}, function(it){


    it.cb('locks/unlocks', t => {
        client.lock('a', {}).then(function (data) {

            console.log('\n', colors.blue(' ONE lock acquired =>'), '\n', data);

            setTimeout(function () {
                client.unlock('a').then(function (data) {
                   t.done();
                }, t);
            }, 4000);


        }, t);

    });




    it.cb('locks/unlocks', t => {

        client.lock('a', {}).then(function (data) {

            console.log('\n', colors.blue(' TWO lock acquired!!! => '), '\n', data);

            setTimeout(function () {
                client.unlock('a').then(function (data) {
                    t.done();
                },t);
            }, 1000);


        }, t);

    });



    it.cb('locks/unlocks', t => {


        client.lock('a', {}).then(function (data) {

            console.log('\n', colors.blue(' THREE lock acquired!!! =>'), '\n', data);

            setTimeout(function () {
                client.unlock('a').then(function (data) {
                    t.done();
                }, t);
            }, 1000);

        }, t);
    });



});
