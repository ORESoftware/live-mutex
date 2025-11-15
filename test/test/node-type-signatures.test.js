'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Node.js test harness test for type signatures and exception handling
 * This test can be run with: node dist/test/node-type-signatures.test.js
 * or: ts-node test/node-type-signatures.test.ts
 */
const main_1 = require("../src/main");
const assert = __importStar(require("assert"));
const port = process.env.lmx_port ? parseInt(process.env.lmx_port) : 8000;
const conf = Object.freeze({ port });
async function runTests() {
    console.log('Starting comprehensive type signature tests...\n');
    // Test 1: Exception classes extend Error
    console.log('Test 1: Exception classes extend Error');
    const lockErr = new main_1.LMXClientLockException('test-key', 'test-id', main_1.LMXLockRequestError.InternalError, 'Test lock error');
    const unlockErr = new main_1.LMXClientUnlockException('test-key', 'test-id', main_1.LMXUnlockRequestError.InternalError, 'Test unlock error');
    assert.ok(lockErr instanceof Error, 'LMXClientLockException should extend Error');
    assert.ok(unlockErr instanceof Error, 'LMXClientUnlockException should extend Error');
    assert.strictEqual(lockErr.name, 'LMXClientLockException');
    assert.strictEqual(unlockErr.name, 'LMXClientUnlockException');
    console.log('✓ Exception classes correctly extend Error\n');
    // Test 2: Exceptions can be passed to Error handlers
    console.log('Test 2: Exceptions can be passed to Error handlers');
    const errorHandler = (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message);
        return err.message;
    };
    errorHandler(lockErr);
    errorHandler(unlockErr);
    console.log('✓ Exceptions can be passed to Error handlers\n');
    // Test 3: Start broker and client
    console.log('Test 3: Starting broker and client');
    const broker = new main_1.Broker1(conf);
    await broker.start();
    const client = new main_1.Client(conf);
    await client.ensure();
    console.log('✓ Broker and client started\n');
    // Test 4: Lock with callback only
    console.log('Test 4: Lock with callback only');
    await new Promise((resolve, reject) => {
        client.lock('test-key-1', (err, result) => {
            if (err)
                return reject(err);
            assert.ok(result, 'Should return lock result');
            assert.ok(result.id, 'Should have id');
            client.unlock('test-key-1', result.id, (unlockErr) => {
                if (unlockErr)
                    return reject(unlockErr);
                resolve();
            });
        });
    });
    console.log('✓ Lock with callback only works\n');
    // Test 5: Lock with number ttl
    console.log('Test 5: Lock with number ttl');
    await new Promise((resolve, reject) => {
        // @ts-ignore - testing legacy signature
        client.lock('test-key-2', 1000, (err, result) => {
            if (err)
                return reject(err);
            assert.ok(result, 'Should return lock result');
            client.unlock('test-key-2', result.id, (unlockErr) => {
                if (unlockErr)
                    return reject(unlockErr);
                resolve();
            });
        });
    });
    console.log('✓ Lock with number ttl works\n');
    // Test 6: Lock with options object
    console.log('Test 6: Lock with options object');
    await new Promise((resolve, reject) => {
        client.lock('test-key-3', { ttl: 5000, force: false }, (err, result) => {
            if (err)
                return reject(err);
            assert.ok(result, 'Should return lock result');
            client.unlock('test-key-3', result.id, (unlockErr) => {
                if (unlockErr)
                    return reject(unlockErr);
                resolve();
            });
        });
    });
    console.log('✓ Lock with options object works\n');
    // Test 7: Unlock with string id
    console.log('Test 7: Unlock with string id');
    await new Promise((resolve, reject) => {
        client.lock('test-key-4', (err, result) => {
            if (err)
                return reject(err);
            const lockId = result.id;
            client.unlock('test-key-4', lockId, (unlockErr) => {
                if (unlockErr)
                    return reject(unlockErr);
                resolve();
            });
        });
    });
    console.log('✓ Unlock with string id works\n');
    // Test 8: Unlock with options object
    console.log('Test 8: Unlock with options object');
    await new Promise((resolve, reject) => {
        client.lock('test-key-5', (err, result) => {
            if (err)
                return reject(err);
            client.unlock('test-key-5', { id: result.id, force: false }, (unlockErr) => {
                if (unlockErr)
                    return reject(unlockErr);
                resolve();
            });
        });
    });
    console.log('✓ Unlock with options object works\n');
    // Test 9: Unlock with boolean force
    console.log('Test 9: Unlock with boolean force');
    await new Promise((resolve, reject) => {
        client.lock('test-key-6', (err, result) => {
            if (err)
                return reject(err);
            client.unlock('test-key-6', { force: true }, (unlockErr) => {
                if (unlockErr)
                    return reject(unlockErr);
                resolve();
            });
        });
    });
    console.log('✓ Unlock with boolean force works\n');
    // Test 10: Promise-based unlockp with string id
    console.log('Test 10: Promise-based unlockp with string id');
    const lockResult = await client.lockp('test-key-7');
    assert.ok(lockResult.id, 'Should have id');
    await client.unlockp('test-key-7', lockResult.id);
    console.log('✓ Promise-based unlockp with string id works\n');
    // Test 11: Promise-based unlockp with boolean
    console.log('Test 11: Promise-based unlockp with boolean');
    await client.lockp('test-key-8');
    await client.unlockp('test-key-8', true);
    console.log('✓ Promise-based unlockp with boolean works\n');
    // Test 12: Promise-based unlockp with options
    console.log('Test 12: Promise-based unlockp with options');
    const lockResult2 = await client.lockp('test-key-9');
    await client.unlockp('test-key-9', { id: lockResult2.id });
    console.log('✓ Promise-based unlockp with options works\n');
    // Test 13: All unlock signature variations
    console.log('Test 13: All unlock signature variations');
    const keys = ['key-a', 'key-b', 'key-c', 'key-d'];
    await Promise.all(keys.map((key, i) => {
        return new Promise((resolve, reject) => {
            client.lock(key, (err, result) => {
                if (err)
                    return reject(err);
                // Test different unlock signatures
                if (i === 0) {
                    // unlock(key, callback)
                    client.unlock(key, (unlockErr) => {
                        if (unlockErr)
                            return reject(unlockErr);
                        resolve();
                    });
                }
                else if (i === 1) {
                    // unlock(key, id, callback)
                    client.unlock(key, result.id, (unlockErr) => {
                        if (unlockErr)
                            return reject(unlockErr);
                        resolve();
                    });
                }
                else if (i === 2) {
                    // unlock(key, {id}, callback)
                    client.unlock(key, { id: result.id }, (unlockErr) => {
                        if (unlockErr)
                            return reject(unlockErr);
                        resolve();
                    });
                }
                else {
                    // unlock(key, {force}, callback)
                    client.unlock(key, { force: true }, (unlockErr) => {
                        if (unlockErr)
                            return reject(unlockErr);
                        resolve();
                    });
                }
            });
        });
    }));
    console.log('✓ All unlock signature variations work\n');
    // Cleanup
    console.log('Cleaning up...');
    client.close();
    await new Promise((resolve) => {
        broker.close((err) => {
            if (err)
                console.error('Broker close error:', err);
            resolve();
        });
    });
    console.log('✓ Cleanup complete\n');
    console.log('✅ All tests passed!');
}
// Run tests
runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
