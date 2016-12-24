const suman = require('suman');
const Test = suman.init(module, {});


Test.create(__filename, {mode: 'parallel'}, function (assert, before, it) {

    const Client = require('../client');
    const lmUtils = require('../utils');

    before('promise', function(){

        return lmUtils.conditionallyLaunchSocketServer({

        }).then(function(data){

            console.log('data from conditionallyLaunchSocketServer => ', data);

        }, function(err){
            if(err){
                console.error(err.stack);
            }
            else{
                throw new Error('no error passed to reject handler');
            }

        });

    });


    it('yes', t => {

        const client = new Client();
        return client.lock('z').then(function(){
            return client.unlock('z');
        });
    });


    it.cb('yes', t => {

        const client = new Client();
        return client.lock('z').then(function(){
             client.unlock('z', t.done);
        });
    });

    it('yes', t => {

        const client = new Client();
        return client.lock('z').then(function(){
            return client.unlock('z');
        });
    });

    it.cb('yes', t => {

        const client = new Client();
         client.lock('z', function(err){
             client.unlock('z', t.done);
        });
    });

});