
import {Client, Broker} from 'live-mutex';
import * as async from 'async';
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


    async.series([

      function(cb){

        const c = Client.create();
        c.ensure((err, c) => {

          if (err) {
            return cb(err);
          }

          debugger;

          c.lock('z', function (err, v) {
            if (err) {
              return cb(err);
            }
            console.log('the error:', err);
            console.log('the v:', v);
            console.log('the id:', v.id);
            c.unlock('z', v.id, function (err, v) {
              debugger;
              console.log(err,v);
                cb(err, v);
            });
          });

        });
      },
      function (cb) {

        debugger;

        const c = new Client();
        c.ensure().then(function () {

          debugger;

          c.lock('z', function (err, {id}) {

            debugger;

            if (err) return cb(err);
            c.unlock('z', id, cb);
          });
        });
      },
      function (cb) {

        debugger;

        const c = Client.create();

        c.ensure().then(c => {
          c.lock('z', function (err, {id}) {

            debugger;
            if (err) return cb(err);
            c.unlock('z', id, cb);
          });

        });
      },
      function (cb) {

         Client.create().ensure().then(c => {

          debugger;

           c.lockp('z').then(function ({unlock}) {

             debugger;
            if (unlock.acquired !== true) {
              return Promise.reject('acquired was not true.');
            }

            debugger;

            unlock(cb);
          });
        });
      }


    ], (err) => {

      debugger;

      if(err){
        console.error('final error:',err);
      }

      console.log('all done.');
    });
    
  });





});
