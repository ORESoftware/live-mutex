
import {Client, Broker} from '../dist/main';
import * as async from 'async';
import * as assert from "assert";
import * as domain from "domain";

// Use random port to avoid conflicts with other tests
const port = 8000 + Math.floor(Math.random() * 1000);

Promise.all([
  new Broker({port}).ensure(),
  new Client({port}).connect()
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

        const c = Client.create({port});
        c.ensure((err, client) => {

          if (err) {
            return cb(err);
          }

          if (!client) {
            return cb(new Error('Client ensure returned undefined'));
          }

          

          client.lock('z', function (err, v) {
            if (err) {
              return cb(err);
            }
            console.log('the error:', err);
            console.log('the v:', v);
            console.log('the id:', v.id);
            client.unlock('z', v.id, function (err, v) {
              
              console.log(err,v);
                cb(err, v);
            });
          });

        });
      },
      function (cb) {

        

        const c = new Client({port});
        c.ensure().then(function () {

          

          c.lock('z', function (err, {id}) {

            

            if (err) return cb(err);
            c.unlock('z', id, cb);
          });
        });
      },
      function (cb) {

        

        const c = Client.create({port});

        c.ensure().then(c => {
          c.lock('z', function (err, {id}) {

            
            if (err) return cb(err);
            c.unlock('z', id, cb);
          });

        });
      },
      function (cb) {

         Client.create({port}).ensure().then(c => {

          

           c.lockp('z').then(function ({unlock}) {

             
            if (unlock.acquired !== true) {
              return Promise.reject('acquired was not true.');
            }

            

            unlock((err, result) => {
              cb(err, result);
            });
          });
        });
      }


    ], (err) => {

      

      // Cleanup: close client and broker
      const cleanup = () => {
        try {
          c.close();
        } catch (e) {
          // Ignore cleanup errors
        }
        
        b.close((closeErr) => {
          if (closeErr) {
            console.error('Broker close error:', closeErr);
          }
          
          if(err){
            console.error('final error:',err);
            process.exit(1);
          } else {
            console.log('all done.');
            process.exit(0);
          }
        });
      };
      
      cleanup();
    });
    
  });





});
