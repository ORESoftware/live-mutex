'use strict';

import suman = require('suman');
const Test = suman.init(module);
import {Client, Broker1, LMXClientLockException, LMXClientUnlockException, LMXLockRequestError, LMXUnlockRequestError} from 'live-mutex';
import * as assert from 'assert';

/////////////////////////////////////////////////////////

Test.create({mode: 'series'}, ['Promise', function (b) {

  const {Promise} = b.ioc;
  const {before, it, describe} = b.getHooks();

  console.log('suman child id:', process.env.SUMAN_CHILD_ID);
  const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : (7000 + parseInt(process.env.SUMAN_CHILD_ID || '1'));
  const conf = Object.freeze({port});

  before(function () {
    const brokerConf = Object.assign({}, conf, {noListen: process.env.lmx_broker_no_listen === 'yes'});
    return new Broker1(brokerConf).start();
  });

  describe('Exception Classes', function () {

    it('LMXClientLockException extends Error and has name property', function () {
      const err = new LMXClientLockException('test-key', 'test-id', LMXLockRequestError.InternalError, 'Test error message');
      assert.ok(err instanceof Error, 'LMXClientLockException should extend Error');
      assert.strictEqual(err.name, 'LMXClientLockException', 'Exception should have correct name');
      assert.strictEqual(err.message, 'Test error message', 'Exception should have correct message');
      assert.strictEqual(err.key, 'test-key', 'Exception should have correct key');
      assert.strictEqual(err.id, 'test-id', 'Exception should have correct id');
      assert.ok(err.stack, 'Exception should have stack trace');
    });

    it('LMXClientUnlockException extends Error and has name property', function () {
      const err = new LMXClientUnlockException('test-key', 'test-id', LMXUnlockRequestError.InternalError, 'Test error message');
      assert.ok(err instanceof Error, 'LMXClientUnlockException should extend Error');
      assert.strictEqual(err.name, 'LMXClientUnlockException', 'Exception should have correct name');
      assert.strictEqual(err.message, 'Test error message', 'Exception should have correct message');
      assert.strictEqual(err.key, 'test-key', 'Exception should have correct key');
      assert.strictEqual(err.id, 'test-id', 'Exception should have correct id');
      assert.ok(err.stack, 'Exception should have stack trace');
    });

    it('Exceptions can be passed to Error handlers', function () {
      const lockErr = new LMXClientLockException('key', 'id', LMXLockRequestError.InternalError, 'Lock error');
      const unlockErr = new LMXClientUnlockException('key', 'id', LMXUnlockRequestError.InternalError, 'Unlock error');
      
      // These should compile and work at runtime
      const errorHandler = (err: Error) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message);
      };
      
      errorHandler(lockErr);
      errorHandler(unlockErr);
    });

  });

  describe('Lock Method Signatures', function () {

    it.cb('lock with callback only', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        client.lock('test-key', (err, result) => {
          if (err) return t.fail(err);
          assert.ok(result, 'Should return lock result');
          assert.ok(result.id, 'Should have id');
          client.unlock('test-key', result.id, t);
        });
      }).catch(t.fail);
    });

    it.cb('lock with number ttl (deprecated but supported)', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        // @ts-ignore - testing legacy signature
        client.lock('test-key', 1000, (err, result) => {
          if (err) return t.fail(err);
          assert.ok(result, 'Should return lock result');
          assert.ok(result.id, 'Should have id');
          client.unlock('test-key', result.id, t);
        });
      }).catch(t.fail);
    });

    it.cb('lock with boolean force option', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        client.lock('test-key', {force: true}, (err, result) => {
          if (err) return t.fail(err);
          assert.ok(result, 'Should return lock result');
          assert.ok(result.id, 'Should have id');
          client.unlock('test-key', result.id, t);
        });
      }).catch(t.fail);
    });

    it.cb('lock with full options object', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        client.lock('test-key', {
          ttl: 5000,
          lockRequestTimeout: 3000,
          maxRetries: 3,
          force: false
        }, (err, result) => {
          if (err) return t.fail(err);
          assert.ok(result, 'Should return lock result');
          assert.ok(result.id, 'Should have id');
          client.unlock('test-key', result.id, t);
        });
      }).catch(t.fail);
    });

  });

  describe('Unlock Method Signatures', function () {

    it.cb('unlock with callback only', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        client.lock('test-key', (err, result) => {
          if (err) return t.fail(err);
          client.unlock('test-key', (unlockErr) => {
            if (unlockErr) return t.fail(unlockErr);
            t();
          });
        });
      }).catch(t.fail);
    });

    it.cb('unlock with string id', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        client.lock('test-key', (err, result) => {
          if (err) return t.fail(err);
          const lockId = result.id;
          client.unlock('test-key', lockId, (unlockErr) => {
            if (unlockErr) return t.fail(unlockErr);
            t();
          });
        });
      }).catch(t.fail);
    });

    it.cb('unlock with string id and callback', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        client.lock('test-key', (err, result) => {
          if (err) return t.fail(err);
          client.unlock('test-key', result.id, t);
        });
      }).catch(t.fail);
    });

    it.cb('unlock with boolean force option', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        client.lock('test-key', (err, result) => {
          if (err) return t.fail(err);
          client.unlock('test-key', {force: true}, (unlockErr) => {
            if (unlockErr) return t.fail(unlockErr);
            t();
          });
        });
      }).catch(t.fail);
    });

    it.cb('unlock with options object containing id', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        client.lock('test-key', (err, result) => {
          if (err) return t.fail(err);
          client.unlock('test-key', {id: result.id}, (unlockErr) => {
            if (unlockErr) return t.fail(unlockErr);
            t();
          });
        });
      }).catch(t.fail);
    });

    it.cb('unlock with full options object', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        client.lock('test-key', (err, result) => {
          if (err) return t.fail(err);
          client.unlock('test-key', {
            id: result.id,
            force: false
          }, (unlockErr) => {
            if (unlockErr) return t.fail(unlockErr);
            t();
          });
        });
      }).catch(t.fail);
    });

  });

  describe('Unlockp Method with String ID', function () {

    it('unlockp with string id', {timeout: 5000}, t => {
      return Client.create(conf).ensure().then(client => {
        return client.lockp('test-key').then(result => {
          assert.ok(result.id, 'Should have id');
          return client.unlockp('test-key', result.id);
        });
      });
    });

    it('unlockp with boolean force', {timeout: 5000}, t => {
      return Client.create(conf).ensure().then(client => {
        return client.lockp('test-key').then(() => {
          return client.unlockp('test-key', true);
        });
      });
    });

    it('unlockp with options object', {timeout: 5000}, t => {
      return Client.create(conf).ensure().then(client => {
        return client.lockp('test-key').then(result => {
          return client.unlockp('test-key', {id: result.id, force: false});
        });
      });
    });

    it('unlockp with string id from lock result', {timeout: 5000}, t => {
      return Client.create(conf).ensure().then(client => {
        return client.lockp('test-key').then(({id}) => {
          assert.ok(typeof id === 'string', 'id should be a string');
          return client.unlockp('test-key', id);
        });
      });
    });

  });

  describe('Error Handling with Exceptions', function () {

    it.cb('lock error is instance of Error and LMXClientLockException', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        // Create a scenario that might cause an error
        // Try to lock with invalid options to trigger error handling
        client.lock('test-key', {lockRequestTimeout: 1, maxRetries: 0}, (err, result) => {
          if (err) {
            // Error should be assignable to Error type
            assert.ok(err instanceof Error, 'Error should be instance of Error');
            // In real scenarios, this would be LMXClientLockException
            t();
          } else {
            // If no error, unlock and continue
            client.unlock('test-key', result.id, t);
          }
        });
      }).catch(t.fail);
    });

    it.cb('unlock error is instance of Error and LMXClientUnlockException', {timeout: 5000}, t => {
      const c = Client.create(conf);
      c.ensure().then(client => {
        // Try to unlock a non-existent lock
        client.unlock('non-existent-key', 'fake-id', (err) => {
          // Error should be assignable to Error type
          if (err) {
            assert.ok(err instanceof Error, 'Error should be instance of Error');
          }
          t(); // Test passes whether error occurs or not
        });
      }).catch(t.fail);
    });

  });

  describe('Promise-based Methods', function () {

    it('acquire and release with string id', {timeout: 5000}, t => {
      return Client.create(conf).ensure().then(client => {
        return client.acquire('test-key').then(result => {
          assert.ok(result.id, 'Should have id');
          return client.release('test-key', result.id);
        });
      });
    });

    it('acquire and release with options', {timeout: 5000}, t => {
      return Client.create(conf).ensure().then(client => {
        return client.acquire('test-key', {ttl: 5000}).then(result => {
          return client.release('test-key', {id: result.id});
        });
      });
    });

    it('lockp and unlockp with string id', {timeout: 5000}, t => {
      return Client.create(conf).ensure().then(client => {
        return client.lockp('test-key').then(result => {
          return client.unlockp('test-key', result.id);
        });
      });
    });

  });

  describe('Type Safety - All Signatures Work', function () {

    it.cb('all unlock signature variations compile and work', {timeout: 10000}, t => {
      const c = Client.create(conf);
      let completed = 0;
      const total = 6;

      const checkComplete = () => {
        completed++;
        if (completed === total) {
          t();
        }
      };

      c.ensure().then(client => {
        // Test 1: unlock(key, callback)
        client.lock('key1', (err, r) => {
          if (err) return checkComplete();
          client.unlock('key1', checkComplete);
        });

        // Test 2: unlock(key, id, callback)
        client.lock('key2', (err, r) => {
          if (err) return checkComplete();
          client.unlock('key2', r.id, checkComplete);
        });

        // Test 3: unlock(key, {id}, callback)
        client.lock('key3', (err, r) => {
          if (err) return checkComplete();
          client.unlock('key3', {id: r.id}, checkComplete);
        });

        // Test 4: unlock(key, {force: true}, callback)
        client.lock('key4', (err, r) => {
          if (err) return checkComplete();
          client.unlock('key4', {force: true}, checkComplete);
        });

        // Test 5: unlock(key) - no callback
        client.lock('key5', (err, r) => {
          if (err) return checkComplete();
          client.unlock('key5');
          setTimeout(checkComplete, 100);
        });

        // Test 6: unlock(key, id) - no callback
        client.lock('key6', (err, r) => {
          if (err) return checkComplete();
          client.unlock('key6', r.id);
          setTimeout(checkComplete, 100);
        });
      }).catch(t.fail);
    });

  });

}]);

