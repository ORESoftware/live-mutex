#!/usr/bin/env node
'use strict';

/**
 * Quick memory leak test - shorter duration for initial validation
 */

import { runMemoryLeakTest } from './memory-leak-test';

// Override test config for quicker test
const originalConfig = require('./memory-leak-test').TEST_CONFIG;
if (originalConfig) {
    originalConfig.duration = 30000; // 30 seconds
    originalConfig.clientCount = 10;
    originalConfig.operationsPerSecond = 5;
}

runMemoryLeakTest()
    .then(() => {
        console.log('\n✓ Quick memory test completed');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n✗ Quick memory test failed:', err);
        process.exit(1);
    });

