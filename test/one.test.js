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
        client.lock('a', {}, function (err, data) {

            if(err){
                return t.fail(err);
            }

            console.log('\n', colors.yellow(' ONE lock acquired!!! => '), '\n', data);

            setTimeout(function () {
                client.unlock('a', function(err){
                    if(err){
                        return t.fail(err);
                    }
                    else{
                        console.log(colors.yellow(' ONE lock released!!! => '));
                        t.done();
                    }

                });
            }, 3000);


        });

    });




    it.cb('locks/unlocks', t => {

        client.lock('a', {}, function (err, data) {

            if(err){
                return t.fail(err);
            }

            console.log('\n', colors.blue(' TWO lock acquired!!! => '), '\n', data);

            setTimeout(function () {
                client.unlock('a', function(err){
                    if(err){
                        return t.fail(err);
                    }
                    else{
                        console.log(colors.blue(' TWO lock released!!! => '));
                        t.done();
                    }

                });
            }, 1000);


        });

    });



    it.cb('locks/unlocks', t => {


        client.lock('a', {}, function (err, data) {

            if(err){
                return t.fail(err);
            }

            console.log('\n', colors.green(' THREE lock acquired!!! => '), '\n', data);

            setTimeout(function () {
                client.unlock('a', function(err){
                    if(err){
                         t.fail(err);
                    }
                    else{
                        console.log(colors.green(' THREE lock released!!! => '));
                        t.done();
                    }

                });
            }, 1000);


        });
    });



});
