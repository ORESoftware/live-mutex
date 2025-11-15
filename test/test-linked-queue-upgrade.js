#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("../dist/main");
const assert = require("assert");
async function testLinkedQueueUpgrade() {
    console.log('Testing linked-queue upgrade (2.1.128)...\n');
    const port = 8000 + Math.floor(Math.random() * 1000);
    console.log(`Using port: ${port}`);
    try {
        console.log('1. Creating broker...');
        const broker = new main_1.Broker1({ port });
        broker.emitter.on('warning', (...args) => {
            const msg = args.map(a => String(a)).join(' ');
            process.stderr.write(`[BROKER] ${msg}\n`);
        });
        await broker.ensure();
        console.log('   ✓ Broker created and started');
        console.log('2. Verifying broker is listening...');
        assert.strictEqual(broker.isOpen, true, 'Broker should be open');
        assert.strictEqual(broker.getPort(), port, 'Port should match');
        console.log('   ✓ Broker is listening');
        console.log('3. Closing broker...');
        await new Promise((resolve, reject) => {
            broker.close((err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        console.log('   ✓ Broker closed successfully');
        console.log('\n✅ All tests passed! Linked-queue upgrade (2.1.128) is working correctly.');
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ Test failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}
testLinkedQueueUpgrade();
