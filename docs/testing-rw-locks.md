# Testing Reader-Writer Locks

This document describes how to test the reader-writer lock functionality in Live Mutex.

## Overview

Live Mutex provides two types of reader-writer lock clients:
- `RWLockWritePrefClient` - Write-preferring RW lock (recommended)
- `RWLockClient` - Read-preferring RW lock (basic implementation)

## Test Files

### 1. `test/rw-lock-file-test-2.ts`

Comprehensive file-based test that verifies RW lock behavior by reading/writing to a file. This test includes:

- **Test 1**: Multiple concurrent readers
- **Test 2**: Writer exclusive access
- **Test 3**: Sequential writes maintaining order
- **Test 4**: Mixed readers and writers
- **Test 5**: Stress test with many concurrent operations

**Features:**
- Extensive debug logging to `/tmp/lmx-rw-test.log`
- Violation detection (checks for lock ordering violations)
- File-based verification (ensures operations happen in correct order)

**Usage:**
```bash
# Compile TypeScript
tsc test/rw-lock-file-test-2.ts --outDir test --module commonjs --target es2020 --esModuleInterop --skipLibCheck

# Run test
node test/rw-lock-file-test-2.js
```

### 2. `test/comprehensive-rw-lock-test.ts`

Comprehensive test suite covering all aspects of RW lock behavior:

- **Test 1**: Concurrent Readers - Verifies multiple readers can read simultaneously
- **Test 2**: Writer Exclusive - Ensures writers have exclusive access
- **Test 3**: Sequential Writes - Verifies write operations maintain order
- **Test 4**: Write Preference - Tests that writers are prioritized
- **Test 5**: Stress Test - 100 operations with mixed reads/writes
- **Test 6**: File Consistency - Tests append operations maintain consistency

**Usage:**
```bash
# Compile TypeScript
tsc test/comprehensive-rw-lock-test.ts --outDir test --module commonjs --target es2020 --esModuleInterop --skipLibCheck

# Run test
node test/comprehensive-rw-lock-test.js
```

## Running Tests

### Prerequisites

1. Ensure the broker is running or will be started by the test
2. Compile TypeScript files to JavaScript
3. Make sure ports are available (default: 3333, 4444)

### Quick Start

```bash
# From project root
cd /path/to/live-mutex

# Compile all test files
tsc test/rw-lock-file-test-2.ts --outDir test --module commonjs --target es2020 --esModuleInterop --skipLibCheck
tsc test/comprehensive-rw-lock-test.ts --outDir test --module commonjs --target es2020 --esModuleInterop --skipLibCheck

# Run comprehensive test
node test/comprehensive-rw-lock-test.js

# Run file-based test with detailed logging
node test/rw-lock-file-test-2.js
```

### Using npm scripts (if configured)

```bash
npm run test:rw-locks
```

## Test Scenarios

### Scenario 1: Concurrent Readers

**Expected Behavior:**
- Multiple readers should be able to acquire read locks simultaneously
- All readers should see the same value
- No blocking between readers

**Test:**
```typescript
const readers = [];
for (let i = 0; i < 5; i++) {
    readers.push(
        client.acquireReadLock('key', {}, (err, release) => {
            // Read operation
            release();
        })
    );
}
await Promise.all(readers);
```

### Scenario 2: Writer Exclusive Access

**Expected Behavior:**
- When a writer holds the lock, no readers or other writers can acquire
- Writers have exclusive access
- Readers wait until writer releases

**Test:**
```typescript
// Writer acquires
client1.acquireWriteLock('key', {}, (err, release) => {
    // Writer holds lock exclusively
    // Any readers/writers will wait
    
    release();
});

// Reader tries to acquire (will wait)
client2.acquireReadLock('key', {}, (err, release) => {
    // Only executes after writer releases
    release();
});
```

### Scenario 3: Sequential Writes

**Expected Behavior:**
- Writes should happen in order
- Each write should see the result of the previous write
- No lost updates

**Test:**
```typescript
// Write 1
await client1.acquireWriteLock('key', {}, (err, release) => {
    writeFile('VALUE-1');
    release();
});

// Write 2 (waits for Write 1)
await client2.acquireWriteLock('key', {}, (err, release) => {
    const current = readFile(); // Should be 'VALUE-1'
    writeFile('VALUE-2');
    release();
});
```

### Scenario 4: Write Preference

**Expected Behavior:**
- Writers should be prioritized over readers
- If readers are waiting and a writer arrives, writer should get priority
- This prevents writer starvation

**Test:**
```typescript
// Start multiple readers
const readers = [/* ... */];

// Writer arrives (should get priority)
setTimeout(() => {
    client.acquireWriteLock('key', {}, (err, release) => {
        // Should acquire before waiting readers
        release();
    });
}, 50);
```

## Debugging

### Enable Debug Logging

The file-based test (`rw-lock-file-test-2.ts`) includes extensive debug logging:

1. **Console Output**: Real-time logging to console
2. **Log File**: Detailed logs written to `/tmp/lmx-rw-test.log`

### Log File Analysis

The log file contains:
- Timestamp for each operation
- Operation type (acquire/release read/write)
- Client IDs
- File contents at each step
- Timing information
- Violation detection

**Example log entry:**
```
[2025-11-14T18:23:56.479Z] [10] Reader R1-0 acquired read lock {"readerId":"R1-0","acquireTime":"1ms","timestamp":1763144636479}
[2025-11-14T18:23:56.479Z] [11] Reader R1-0 read file {"readerId":"R1-0","content":"INIT","readTime":"0ms","expectedValue":"INIT","matches":true}
```

### Common Issues

#### Issue: Timeout Errors

**Symptom:**
```
lmx client lock request timed out after 9000 ms
```

**Possible Causes:**
1. Broker not responding
2. Lock held too long
3. Deadlock situation

**Solutions:**
- Increase `lockRequestTimeout` in client options
- Check broker is running
- Verify locks are being released properly

#### Issue: Lock Violations

**Symptom:**
```
⚠️  VIOLATIONS DETECTED
Writer W1 acquired while 2 readers active
```

**Possible Causes:**
1. Race condition in broker
2. Incorrect lock implementation
3. Timing issues

**Solutions:**
- Check broker logs
- Verify RW lock client implementation
- Review test timing

#### Issue: Incorrect File Values

**Symptom:**
```
Writer W1 saw unexpected value before write
Expected: VALUE-1, Actual: VALUE-2
```

**Possible Causes:**
1. Writes happening out of order
2. Readers seeing inconsistent state
3. Lock not properly exclusive

**Solutions:**
- Verify write locks are exclusive
- Check for race conditions
- Review operation ordering

## Best Practices

1. **Always release locks**: Use try/finally or ensure release is called
2. **Set appropriate timeouts**: Don't use infinite timeouts in tests
3. **Verify state**: Check file contents or shared state after operations
4. **Test edge cases**: Empty files, concurrent operations, rapid acquire/release
5. **Monitor logs**: Use debug logging to understand operation flow

## Integration with CI/CD

Add to your test suite:

```bash
# In package.json scripts
{
  "scripts": {
    "test:rw-locks": "tsc test/comprehensive-rw-lock-test.ts --outDir test --module commonjs --target es2020 --esModuleInterop --skipLibCheck && node test/comprehensive-rw-lock-test.js",
    "test:rw-locks:verbose": "tsc test/rw-lock-file-test-2.ts --outDir test --module commonjs --target es2020 --esModuleInterop --skipLibCheck && node test/rw-lock-file-test-2.js"
  }
}
```

## Performance Testing

For performance testing, modify the stress test:

```typescript
// Increase operation count
for (let i = 0; i < 1000; i++) {
    // ... operations
}

// Measure throughput
const start = Date.now();
await Promise.all(operations);
const duration = Date.now() - start;
console.log(`Throughput: ${operations.length / (duration / 1000)} ops/sec`);
```

## Troubleshooting

### Test Hangs

1. Check if broker is running: `lsof -i :3333`
2. Verify clients are connecting: Check broker logs
3. Look for deadlocks: Review lock acquisition order

### Intermittent Failures

1. Increase delays between operations
2. Add more synchronization points
3. Review timing-dependent code

### Port Conflicts

```bash
# Kill processes on test ports
lsof -ti:3333 | xargs kill -9
lsof -ti:4444 | xargs kill -9
```

## Additional Resources

- See `docs/write-preferring-rw-lock.md` for RW lock implementation details
- See `test/@src/rw-lock.test.ts` for additional test examples
- Check broker logs for server-side issues

