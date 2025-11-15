# Broker vs Broker1 Comparison

## Overview

Live-Mutex currently provides two broker implementations: `Broker` and `Broker1`. This document explains the differences and which one to use.

## Current Status

- **Broker1** is the **recommended** and **actively maintained** implementation
- **Broker** is the **legacy** implementation and is being phased out
- The CLI tools (`lmx start`, `lmx_start_server`) use **Broker1**
- New projects should use **Broker1**

## Key Differences

### 1. Message Type Handling

**Broker** has an additional defensive check:
```typescript
if (data.type === 'register-write-flag-check-queued') {
    // This is a response type, not a request type - should not happen
    return;
}
```

**Broker1** does not have this check, as it's not expected to receive this message type as a request.

### 2. Code Structure

Both implementations are nearly identical in structure and functionality. The main difference is that **Broker1** is the newer, cleaner version that will be maintained going forward.

### 3. Usage in Codebase

- **Broker1** is used by:
  - CLI tools (`lm-start-server.ts`)
  - Utility functions (`utils.ts`)
  - Launch broker child process (`launch-broker-child.ts`)

- **Broker** is still exported for backward compatibility but is not used internally

## Which One Should You Use?

### Use Broker1 (Recommended)

```typescript
import {Broker1} from 'live-mutex';

const broker = new Broker1({port: 6970});
await broker.ensure();
```

**Reasons:**
- Actively maintained
- Used by all CLI tools
- Future-proof
- Same API as Broker

### Use Broker (Legacy)

```typescript
import {Broker} from 'live-mutex';

const broker = new Broker({port: 6970});
await broker.ensure();
```

**Only if:**
- You have existing code using Broker
- You're in the process of migrating
- You need the specific defensive check mentioned above

## API Compatibility

Both `Broker` and `Broker1` have **identical APIs**:

- Same constructor options
- Same methods (`ensure()`, `start()`, `close()`, etc.)
- Same event emitter interface
- Same lock management behavior

This means you can switch between them without changing your code:

```typescript
// This works with both
import {Broker, Broker1} from 'live-mutex';

// Both have the same API
const broker1 = new Broker1({port: 6970});
const broker2 = new Broker({port: 6970});

await broker1.ensure();
await broker2.ensure();
```

## Migration Path

If you're currently using `Broker`, migrating to `Broker1` is straightforward:

1. **Change the import:**
   ```typescript
   // Before
   import {Broker} from 'live-mutex';
   
   // After
   import {Broker1} from 'live-mutex';
   ```

2. **Change the class name:**
   ```typescript
   // Before
   const broker = new Broker({port: 6970});
   
   // After
   const broker = new Broker1({port: 6970});
   ```

3. **That's it!** The rest of your code remains the same.

See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for detailed migration instructions.

## Deprecation Timeline

- **Current (v0.2.25)**: Both Broker and Broker1 are available
- **Future**: Broker will be marked as deprecated
- **Future**: Broker will be removed in a future major version

## Technical Details

### File Locations

- `Broker1`: `src/broker-1.ts`
- `Broker`: `src/broker.ts`
- `BrokerOld`: `src/broker-old.ts` (archived)

### Exports

Both are exported from `src/main.ts`:

```typescript
export {Broker, LMXBroker, LvMtxBroker} from './broker';
export {Broker1, LMXBroker as LMXBroker1, LvMtxBroker as LvMtxBroker1} from './broker-1';
```

### Aliases

You can also use these aliases:
- `LMXBroker` → `Broker`
- `LvMtxBroker` → `Broker`
- `LMXBroker1` → `Broker1` (via re-export)
- `LvMtxBroker1` → `Broker1` (via re-export)

## Questions?

If you're unsure which to use, **always choose Broker1**. It's the recommended implementation and will be supported long-term.

