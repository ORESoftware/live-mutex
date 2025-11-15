# Suman Test Analysis

## Summary

Ran suman tests and identified the following:

## False Positives (Setup Issues)

1. **Missing `async` module** - Many tests failed with "Cannot find module 'async'"
   - Tests affected: alphabet.test.ts, alphabet2.test.ts, alphabet3.test.ts, broker-destroy.test.ts, broker.end.test.ts, client-destroy.test.ts, client-end.test.ts, errors.test.ts, general.test.ts, semaphore.test.ts
   - **Fix**: These tests need `async` installed as a dependency (setup-test.sh should handle this)

2. **Missing `live-mutex` module** - Some tests failed with "Cannot find module 'live-mutex'"
   - Tests affected: four-promise.test.ts, ts.test.ts
   - **Fix**: These tests are importing from 'live-mutex' instead of '../../dist/main' or using relative paths

## Real Test Failures (Potential Bugs)

### 1. edge-cases.test.ts - "lock release order independence"
- **Error**: `lmx client lock request timed out after 9000 ms, 2 retries attempted to acquire lock for key "order-test"`
- **Status**: **REAL BUG** - Lock acquisition is timing out, suggesting a deadlock or queue issue
- **Location**: test/@src/edge-cases.test.ts:151

### 2. rw-lock-edge-cases.test.ts - Multiple failures (5 out of 6 tests failed)
All tests are timing out with "*timed out* - did you forget to fire a callback?"

- **"writer blocks all readers"** - Timeout
- **"readers can coexist"** - Timeout  
- **"writer exclusive during readers"** - Timeout
- **"rapid read/write cycles"** - Timeout
- **"write lock timeout when readers hold"** - Timeout

**Status**: **REAL BUGS** - All RW lock tests are timing out, indicating callbacks are not being fired.

**Root Cause Analysis**:
- The RW lock client (`RWLockWritePrefClient`) uses methods like:
  - `registerWriteFlagCheck()` 
  - `registerWriteFlagAndReadersCheck()`
  - `incrementReaders()`
  - `decrementReaders()`
- These methods set up callbacks in `this.resolutions[uuid]` and send messages to the broker
- The broker responds with messages like:
  - `'register-write-flag-success'`
  - `'register-write-flag-and-readers-check-success'`
  - `'increment-readers-success'`
  - `'decrement-readers-success'`
- The client should handle these via UUID lookup in the `onData` handler
- **Issue**: Callbacks are not being called, causing tests to hang

**Possible Causes**:
1. Broker responses not being sent properly
2. Client not receiving broker responses
3. UUID mismatch between request and response
4. Callbacks being cleared before response arrives
5. Timeout handling interfering with callback execution

## Test Results Summary

- **Total Tests**: 101
- **Passed**: 95
- **Failed**: 6 (1 edge-case + 5 RW lock tests)
- **Setup Failures**: 14 (missing dependencies/modules)

## Recommendations

1. **Fix setup issues first**:
   - Ensure `async` module is installed
   - Fix imports in tests to use relative paths instead of 'live-mutex'

2. **Investigate RW lock bugs**:
   - Add logging to track UUID flow between client and broker
   - Verify broker is sending responses with correct UUIDs
   - Check if client is receiving and processing responses correctly
   - Verify timeout handling isn't interfering with callbacks

3. **Fix edge-case test**:
   - Investigate why "order-test" lock acquisition is timing out
   - Check for deadlock conditions in lock release order logic

