
import {Client, Broker} from '../dist/main';
import * as async from 'async';
import * as assert from "assert";
import * as domain from "domain";

// Prefer the serial runner's assigned port, with a random fallback for manual runs.
const port = process.env.LMX_TEST_PORT ? parseInt(process.env.LMX_TEST_PORT, 10) : 8000 + Math.floor(Math.random() * 1000);

Promise.all([
  new Broker({port}).ensure(),
  new Client({port}).connect()
])
.then(function ([b, c]) {

  const clients: Client[] = [c];

  const registerClient = function (client: Client) {
    clients.push(client);
    return client;
  };

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

        const client = registerClient(Client.create({port}));
        client.ensure((err, readyClient) => {

          if (err) {
            return cb(err);
          }

          if (!readyClient) {
            return cb(new Error('Client ensure returned undefined'));
          }

          

          readyClient.lock('z', function (err, v) {
            if (err) {
              return cb(err);
            }
            console.log('the error:', err);
            console.log('the v:', v);
            console.log('the id:', v.id);
            readyClient.unlock('z', v.id, function (err, v) {
              
              console.log(err,v);
                cb(err, v);
            });
          });

        });
      },
      function (cb) {

        const c2 = registerClient(new Client({port}));
        c2.ensure().then(function () {

          c2.lock('z', function (err, {id}) {

            
            if (err) return cb(err);
            c2.unlock('z', id, cb);
          });
        });
      },
      function (cb) {

        

        const c3 = registerClient(Client.create({port}));

        c3.ensure().then(client => {
          client.lock('z', function (err, {id}) {

            
            if (err) return cb(err);
            client.unlock('z', id, cb);
          });

        });
      },
      function (cb) {

         const c4 = registerClient(Client.create({port}));
         c4.ensure().then(c => {

          

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
        clients.forEach(client => {
          try {
            client.close();
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        
        let finished = false;

        const finish = (closeErr?: any) => {
          if (finished) {
            return;
          }

          finished = true;

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
        };

        const closeTimeout = setTimeout(() => finish(), 2000);

        b.close((closeErr) => {
          clearTimeout(closeTimeout);
          finish(closeErr);
        });
      };
      
      cleanup();
    });
    
  });





});
