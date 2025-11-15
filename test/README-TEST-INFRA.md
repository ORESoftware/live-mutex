# Test Infrastructure

## Overview

The test infrastructure has been improved to run tests **serially** with **independent brokers** for each test file. This ensures:

1. **No port conflicts** - Each test gets its own unique port
2. **Isolation** - Tests don't interfere with each other
3. **Reliability** - Tests can be run independently or as a suite
4. **Reproducibility** - Same test file always gets the same port

## Running Tests

### Run all tests
```bash
npm test
```

This will:
1. Build TypeScript
2. Set up dependencies (async, handlebars, etc.)
3. Link the package
4. Run all tests serially (one at a time)

### Run a specific test
```bash
suman test/@src/one.test.ts
```

## Port Allocation

Each test file gets a unique port based on:

1. **Environment variable** `lmx_port` (highest priority - for manual override)
2. **SUMAN_CHILD_ID** (for parallel runs with suman)
3. **Test file path hash** (for serial runs - ensures consistency)

Ports are allocated in the range 7000-9999.

## Configuration

### Serial Execution

Tests run serially (one at a time) as configured in `suman.conf.js`:
```javascript
maxParallelProcesses: 1  // Run tests serially
```

This prevents:
- Port conflicts
- Resource contention
- Race conditions between tests

### Independent Brokers

Each test file creates its own broker instance on a unique port. This ensures:
- Tests don't share state
- Tests can run in any order
- Tests can be run independently

## Test Structure

Tests should follow this pattern for port allocation:

```typescript
import {getTestPort} from '../port-helper';

const port = getTestPort(__filename); // or just getTestPort() for auto-detection
const conf = Object.freeze({port});

// Create broker and client with this config
const broker = new Broker1(conf).ensure();
const client = new Client(conf).ensure();
```

## Troubleshooting

### Port conflicts
If you see port conflicts:
1. Check if a previous test's broker is still running
2. Use `lmx_port` environment variable to override: `lmx_port=8000 npm test`
3. Ensure tests are running serially (check `suman.conf.js`)

### Missing dependencies
If tests fail with "Cannot find module 'async'":
1. Run `./test/setup-test.sh` to install test dependencies
2. Or run `npm install` to install all dependencies

### Module resolution issues
If tests can't find 'live-mutex':
1. Run `npm link` to link the package globally
2. Run `npm link live-mutex` to link it locally
3. Ensure `dist/` directory exists (run `tsc`)

