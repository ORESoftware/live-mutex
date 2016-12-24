'use strict';

const Client = require('../client');
const colors = require('colors/safe');

const Broker = require('../broker');
const broker = new Broker({port: 7002});
const client = new Client({port: 7002});


client.lock('a', {}).then(function (data) {

    console.log('\n', colors.blue(' ONE lock acquired =>'), '\n', data);

    setTimeout(function () {
        client.unlock('a').then(function (data) {
            console.log('\n', colors.green(' => ONE unlock data success! => '), '\n', data, '\n');
        });
    }, 6000);


}, function (err) {

    console.error(err.stack || err);

});


client.lock('a', {}).then(function (data) {

    console.log('\n', colors.blue(' TWO lock acquired!!! => '), '\n', data);

    setTimeout(function () {
        client.unlock('a').then(function (data) {
            console.log('\n', colors.green(' => TWO unlock data success! => '), '\n', data, '\n');
        });
    }, 1000);


}, function (err) {

    console.error(err.stack || err);

});


client.lock('a', {}).then(function (data) {

    console.log('\n', colors.blue(' THREE lock acquired!!! =>'), '\n', data);

    setTimeout(function () {
        client.unlock('a').then(function (data) {
            console.log('\n', colors.green(' => THREE unlock data success! => '), '\n', data, '\n');
        });
    }, 1000);

}, function (err) {

    console.error(err.stack || err);

});