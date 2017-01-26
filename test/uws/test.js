/**
 * Created by oleg on 1/25/17.
 */

const Client = require('../../client');
const Broker = require('../../broker');
const broker = new Broker({port: 7033});

const colors = require('colors/safe');

broker.init(function(){

   new Client({port: 7033})
        .init(function(){

            this.lock('a', {}, function (err, unlock) {

                if (err) {
                    console.error(err);
                }

                console.log('\n', colors.yellow(' ONE lock acquired!!! => '), '\n');

                setTimeout(function () {
                    unlock(function (err) {
                        if (err) {
                            console.error(err);
                        }
                        else {
                            console.log(colors.yellow(' ONE lock released!!! => '));
                        }

                    });
                }, 1500);

            });

        });



});





// const client = new Client({port: 7033});