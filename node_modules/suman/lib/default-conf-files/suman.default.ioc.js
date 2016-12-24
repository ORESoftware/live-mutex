//******************************************************************************************************************
// this is for dependency injection, y'all
// the purpose is to inject dependencies / values that are acquired *asynchronously*
// synchronous deps should be loaded with the require function, as per usual,
// but deps and values (such as db values) can and should be loaded via this module
// tests will run in separate processes, but you can use code sharing (not memory sharing) to share setup between tests,
// which is actually pretty cool
// ******************************************************************************************************************


const http = require('http');


module.exports = data => {  //load async deps for any of your suman tests

    return {

        //the following are examples

        //synchronous dependency acquisition
        'example': function () {
            return {'just':'an example'};
        },

        //asynchronous dependency acquisition, pass data back to test files using error-first callback
        'example_dot_com': cb => {

            http.get({

                host: 'example.com',
                port: 80,
                path: '/',
                agent: false

            }, res => {


                res.setEncoding('utf8');
                var data = '';

                res.on('data', d => {
                    data += d;
                });

                res.on('end', () => {
                    cb(null, data);
                });
            })
        },

        //asynchronous dependency acquisition, return a Promise

        'fs_search' : () => {
            return new Promise(function(resolve, reject){
                  setTimeout(function(){
                      resolve('some filesystem values')
                  },1000);
            });
        }


    }


};
