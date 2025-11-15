#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const memory_leak_test_1 = require("./memory-leak-test");
const originalConfig = require('./memory-leak-test').TEST_CONFIG;
if (originalConfig) {
    originalConfig.duration = 30000;
    originalConfig.clientCount = 10;
    originalConfig.operationsPerSecond = 5;
}
(0, memory_leak_test_1.runMemoryLeakTest)()
    .then(() => {
    console.log('\n✓ Quick memory test completed');
    process.exit(0);
})
    .catch((err) => {
    console.error('\n✗ Quick memory test failed:', err);
    process.exit(1);
});
