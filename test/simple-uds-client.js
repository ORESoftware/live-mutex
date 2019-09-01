'use strict';

const path = require('path');
const fs = require('fs');
const {LMXClient} = require("../dist/main");

const udsPath = path.resolve(__dirname + '/fixtures/uds.sock');

const c = new LMXClient({udsPath});

console.log('if:', c.getConnectionInterface());

c.emitter.on('warning', w => {
  console.error(w);
});

c.emitter.on('error', w => {
  console.error(w);
});

c.ensure(err => {
  
  if (err) {
    throw err;
  }
  
  c.lock('foo', (err, unlock) => {
    
    if (err) {
      throw err;
    }
    
    unlock(err => {
      
      if (err) {
        throw err;
      }
      
      console.log('locked/unlocked succcessfully.');
      process.exit(0);
      
    });
    
  });
  
});