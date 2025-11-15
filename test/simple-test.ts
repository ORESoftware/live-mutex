
import {Client, Broker} from '../dist/main';
import * as assert from "assert";
import * as domain from "domain";

Promise.all([
  new Broker().ensure(),
  new Client().connect()
])
.then(function ([b, c]) {

  b.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('broker warning:', ...arguments);
    }
  });

  c.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('client warning:', ...arguments);
    }
  });

  b.emitter.on('error', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('broker error:', ...arguments);
    }
  });

  c.emitter.on('error', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('client error:', ...arguments);
    }
  });


  const d = domain.create();

  d.once('error', function (err) {
    console.error('domain caught error:',err);
    process.exit(1);
  });

  d.run(function(){


    const series = [
      function(cb: (err?: any, result?: any) => void){

        const c = Client.create();
        c.ensure((err, client) => {

          if (err) {
            return cb(err);
          }

          if (!client) {
            return cb(new Error('Client is undefined'));
          }

          client.lock('z', function (err, v) {
            if (err) {
              return cb(err);
            }
            console.log('the error:', err);
            console.log('the v:', v);
            console.log('the id:', v.id);
            client.unlock('z', {id: v.id}, function (err, v) {
              console.log(err,v);
                cb(err, v);
            });
          });

        });
      },
      function (cb: (err?: any, result?: any) => void) {

        const c = new Client();
        c.ensure().then(function () {

          c.lock('z', function (err, {id}) {

            if (err) return cb(err);
            c.unlock('z', {id}, cb);
          });
        });
      },
      function (cb: (err?: any, result?: any) => void) {

        debugger;

        const c = Client.create();

        c.ensure().then(c => {
          c.lock('z', function (err, {id}) {

            debugger;
            if (err) return cb(err);
            c.unlock('z', {id}, cb);
          });

        });
      },
      function (cb: (err?: any, result?: any) => void) {

         Client.create().ensure().then(c => {

           c.lockp('z').then(function ({unlock}) {

        
            if (unlock.acquired !== true) {
              return Promise.reject('acquired was not true.');
            }


            unlock(cb);
          });
        });
      }
    ];

    // Execute series sequentially
    let index = 0;
    function runNext(err?: any, result?: any) {
      if (err || index >= series.length) {
        return finalCallback(err);
      }
      series[index++](runNext);
    }
    runNext();

    function finalCallback(err: any) {

      debugger;

      if(err){
        console.error('final error:',err);
      }

      console.log('all done.');
    }
    
  });





});
