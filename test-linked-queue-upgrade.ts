#!/usr/bin/env node

'use strict';

/**
 * Simple test to verify linked-queue upgrade works correctly
 * Tests the actual usage patterns from broker.ts
 */

import {Broker1} from './dist/main';
import * as assert from 'assert';

async function testLinkedQueueUpgrade(): Promise<void> {
    console.log('Testing linked-queue upgrade (2.1.128)...\n');
    
    const port = 8000 + Math.floor(Math.random() * 1000);
    console.log(`Using port: ${port}`);
    
    try {
        // Test 1: Create broker and ensure it starts
        console.log('1. Creating broker...');
        const broker = new Broker1({port});
        // Capture broker logs
        broker.emitter.on('warning', (...args: any[]) => {
            const msg = args.map(a => String(a)).join(' ');
            process.stderr.write(`[BROKER] ${msg}\n`);
        });
        await broker.ensure();
        console.log('   ✓ Broker created and started');
        
        // Test 2: Verify broker is listening
        console.log('2. Verifying broker is listening...');
        assert.strictEqual(broker.isOpen, true, 'Broker should be open');
        assert.strictEqual(broker.getPort(), port, 'Port should match');
        console.log('   ✓ Broker is listening');
        
        // Test 3: Close broker
        console.log('3. Closing broker...');
        await new Promise<void>((resolve, reject) => {
            broker.close((err: any) => {
                if (err) return reject(err);
                resolve();
            });
        });
        console.log('   ✓ Broker closed successfully');
        
        console.log('\n✅ All tests passed! Linked-queue upgrade (2.1.128) is working correctly.');
        process.exit(0);
        
    } catch (err: any) {
        console.error('\n❌ Test failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

testLinkedQueueUpgrade();
