// note redis must be running locally for this test to work
const path = require('path');
const async = require('async');
const Warlock = require('node-redis-warlock');
const redis = require('redis');

// you must start redis on the default port (6379) for this test to work
// Establish a redis client and pass it to warlock
const client = redis.createClient();
const warlock = Warlock(client);

function firstEnsureKeyIsUnlocked(key, cb) {
  warlock.unlock(key, true, cb);
}

// Set a lock
const key = 'test-lock';

firstEnsureKeyIsUnlocked(key, function (err) {
  
  if (err) {
    throw err;
  }
  
  const a = Array.apply(null, {length: 1000});
  const start = Date.now();
  
  let i = 0;
  
  const ttl = 3; // Lifetime of the lock
  const maxAttempts = 4000; // Max number of times to try setting the lock before erroring
  
  async.each(a, function (val, cb) {
    
    const w = Math.ceil(Math.random() * 10);
    
    warlock.optimistic(key, ttl, maxAttempts, w, function (err, unlock) {
      if (err) {
        return cb(err);
      }
      
      if (typeof unlock === 'function') {
        // console.log('unlocking...' + i++);
        unlock(cb);
      }
      else {
        console.error('error => Could not acquire lock.');
        process.nextTick(cb);
        
      }
    });
    
  }, function complete(err) {
    
    if (err) {
      throw err;
    }
    
    const diff = Date.now() - start;
    console.log(' => Time required for Warlock => ', diff);
    console.log(' => Lock/unlock cycles per millisecond => ', Number(a.length / diff).toFixed(3));
    process.exit(0);
  });
  
});


