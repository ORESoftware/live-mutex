
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
      console.error('broker warning:', v);
    }
  });

  c.emitter.on('warning', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('client warning:', v);
    }
  });

  b.emitter.on('error', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('broker error:', v);
    }
  });

  c.emitter.on('error', function (v) {
    if (!String(v).match(/no lock with key/)) {
      console.error('client error:', v);
    }
  });


  const d = domain.create();

  d.once('error', function (err) {
    console.error('domain caught error:',err);
    process.exit(1);
  });

  d.run(function(){

    // Sequential execution without async module
    (async function() {
      const testClients: Client[] = [];
      
      try {
        // Test 1
        await new Promise<void>((resolve, reject) => {
          const c1 = Client.create();
          testClients.push(c1);
          c1.ensure((err: any, client?: any) => {
            if (err) {
              return reject(err);
            }
            if (!client) {
              return reject(new Error('Client is undefined'));
            }

            debugger;

            client.lock('z', function (err: any, v: any) {
              if (err) {
                return reject(err);
              }
              console.log('the error:', err);
              console.log('the v:', v);
              console.log('the id:', v.id);
              client.unlock('z', {id: v.id}, function (err: any, v: any) {
                debugger;
                console.log(err,v);
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            });
          });
        });

        // Test 2
        await new Promise<void>((resolve, reject) => {
          debugger;

          const c2 = new Client();
          testClients.push(c2);
          c2.ensure().then(function () {
            debugger;

            c2.lock('z', function (err: any, {id}: any) {
              debugger;

              if (err) return reject(err);
              c2.unlock('z', {id: id}, (unlockErr: any) => {
                if (unlockErr) {
                  reject(unlockErr);
                } else {
                  resolve();
                }
              });
            });
          }).catch(reject);
        });

        // Test 3
        await new Promise<void>((resolve, reject) => {
          debugger;

          const c3 = Client.create();
          testClients.push(c3);

          c3.ensure().then(client => {
            if (!client) {
              return reject(new Error('Client is undefined'));
            }
            client.lock('z', function (err: any, {id}: any) {
              debugger;
              if (err) return reject(err);
              client.unlock('z', {id: id}, (unlockErr: any) => {
                if (unlockErr) {
                  reject(unlockErr);
                } else {
                  resolve();
                }
              });
            });
          }).catch(reject);
        });

        // Test 4
        await new Promise<void>((resolve, reject) => {
          Client.create().ensure().then(c4 => {
            if (!c4) {
              return reject(new Error('Client is undefined'));
            }
            testClients.push(c4);

            debugger;

            c4.lockp('z').then(function ({unlock}) {
              debugger;
              if (unlock.acquired !== true) {
                return reject('acquired was not true.');
              }

              debugger;

              unlock((unlockErr: any) => {
                if (unlockErr) {
                  reject(unlockErr);
                } else {
                  resolve();
                }
              });
            }).catch(reject);
          }).catch(reject);
        });

        debugger;
        console.log('all done.');
      } catch (err: any) {
        debugger;
        console.error('final error:', err);
      } finally {
        // Close all test clients
        for (const testClient of testClients) {
          try {
            testClient.close();
          } catch (e) {
            // ignore
          }
        }
        
        // Close initial client
        try {
          c.close();
        } catch (e) {
          // ignore
        }
        
        // Close broker
        await new Promise<void>((resolve) => {
          b.close(() => resolve());
        });
        
        // Exit process
        process.exit(0);
      }
    })();
    
  });





});
