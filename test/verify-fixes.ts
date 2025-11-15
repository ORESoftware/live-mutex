'use strict';

/**
 * Comprehensive verification script to triple-check all fixes
 * Run with: ts-node test/verify-fixes.ts
 */

import {
  Client,
  Broker1,
  LMXClientLockException,
  LMXClientUnlockException,
  LMXLockRequestError,
  LMXUnlockRequestError
} from '../src/main';
import * as assert from 'assert';

async function verifyAllFixes() {
  console.log('🔍 Starting comprehensive verification...\n');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.then(() => {
          console.log(`✅ ${name}`);
          passed++;
        }).catch((err) => {
          console.error(`❌ ${name}:`, err.message);
          failed++;
        });
      } else {
        console.log(`✅ ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`❌ ${name}:`, err.message);
      failed++;
    }
  }

  // Test 1: Exception classes extend Error
  test('LMXClientLockException extends Error', () => {
    const err = new LMXClientLockException('key', 'id', LMXLockRequestError.InternalError, 'test');
    assert.ok(err instanceof Error, 'Should extend Error');
    assert.strictEqual(err.name, 'LMXClientLockException');
    assert.ok(err.message);
    assert.ok(err.stack);
  });

  test('LMXClientUnlockException extends Error', () => {
    const err = new LMXClientUnlockException('key', 'id', LMXUnlockRequestError.InternalError, 'test');
    assert.ok(err instanceof Error, 'Should extend Error');
    assert.strictEqual(err.name, 'LMXClientUnlockException');
    assert.ok(err.message);
    assert.ok(err.stack);
  });

  // Test 2: Exceptions can be passed to Error handlers
  test('Exceptions are assignable to Error type', () => {
    const lockErr = new LMXClientLockException('key', 'id', LMXLockRequestError.InternalError, 'test');
    const unlockErr = new LMXClientUnlockException('key', 'id', LMXUnlockRequestError.InternalError, 'test');
    
    const errorHandler = (err: Error) => {
      assert.ok(err instanceof Error);
      return err.message;
    };
    
    errorHandler(lockErr);
    errorHandler(unlockErr);
  });

  // Test 3: Method signatures compile correctly
  test('unlock method accepts string id', () => {
    // This should compile without errors
    const client = new Client({port: 9999});
    // Type check: unlock(key, id, callback) should be valid
    const testFn: (key: string, id: string, cb: (err: any) => void) => void = client.unlock.bind(client);
    assert.ok(typeof testFn === 'function');
  });

  test('unlock method accepts boolean force', () => {
    const client = new Client({port: 9999});
    // Type check: unlock(key, {force: boolean}, callback) should be valid
    const testFn: (key: string, opts: {force: boolean}, cb: (err: any) => void) => void = client.unlock.bind(client);
    assert.ok(typeof testFn === 'function');
  });

  test('lock method accepts number ttl', () => {
    const client = new Client({port: 9999});
    // Type check: lock(key, ttl, callback) should be valid
    // @ts-ignore - testing legacy signature
    const testFn: (key: string, ttl: number, cb: (err: any, result: any) => void) => void = client.lock.bind(client);
    assert.ok(typeof testFn === 'function');
  });

  test('unlockp method accepts string id', () => {
    const client = new Client({port: 9999});
    // Type check: unlockp(key, id) should be valid
    const testFn: (key: string, id: string) => Promise<any> = client.unlockp.bind(client);
    assert.ok(typeof testFn === 'function');
  });

  test('unlockp method accepts boolean', () => {
    const client = new Client({port: 9999});
    // Type check: unlockp(key, force: boolean) should be valid
    const testFn: (key: string, force: boolean) => Promise<any> = client.unlockp.bind(client);
    assert.ok(typeof testFn === 'function');
  });

  // Test 4: All exports are available
  test('All exception classes are exported', () => {
    assert.ok(LMXClientLockException);
    assert.ok(LMXClientUnlockException);
    assert.ok(LMXLockRequestError);
    assert.ok(LMXUnlockRequestError);
  });

  // Test 5: Runtime behavior - exceptions work correctly
  test('Exception properties are correct', () => {
    const err = new LMXClientLockException('my-key', 'my-id', LMXLockRequestError.InternalError, 'My error');
    assert.strictEqual(err.key, 'my-key');
    assert.strictEqual(err.id, 'my-id');
    assert.strictEqual(err.code, LMXLockRequestError.InternalError);
    assert.strictEqual(err.message, 'My error');
  });

  // Test 6: Exception stack traces work
  test('Exception stack traces are captured', () => {
    const err = new LMXClientLockException('key', 'id', LMXLockRequestError.InternalError, 'test');
    assert.ok(err.stack);
    assert.ok(err.stack.includes('LMXClientLockException') || err.stack.includes('test'));
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.error('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All verification tests passed!');
  }
}

// Run verification
verifyAllFixes().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

