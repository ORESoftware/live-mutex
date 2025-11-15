# Broker Migration Guide: Broker vs Broker1

## Overview

Live-Mutex currently provides two broker implementations:
- **`Broker`** (from `broker.ts`) - Original implementation
- **`Broker1`** (from `broker-1.ts`) - Current recommended implementation

## Current Status

**`Broker1` is the recommended and actively maintained broker implementation.**

- `Broker1` is used by the main codebase and all current tests
- Both implementations have been updated with the same bug fixes
- `Broker` is maintained for backward compatibility but may be deprecated in the future

## Key Differences

### Functionality

Both brokers provide identical functionality:
- Basic lock/unlock operations
- Read-Write (RW) lock support
- Unix Domain Socket (UDS) support
- Version checking
- Inspect and listing commands
- Same configuration options

### Implementation Details

The implementations are nearly identical, with `Broker1` being the more recent version. Both have:
- Same bug fixes applied (double-counting readers, release callbacks, etc.)
- Same API surface
- Same performance characteristics
- Same configuration options

## Migration Steps

### Step 1: Update Imports

**Before:**
```typescript
import {Broker} from 'live-mutex';
```

**After:**
```typescript
import {Broker1} from 'live-mutex';
// Or use the alias
import {Broker1 as Broker} from 'live-mutex';
```

### Step 2: Update Constructor Calls

**Before:**
```typescript
const broker = new Broker({port: 6970, host: 'localhost'});
```

**After:**
```typescript
const broker = new Broker1({port: 6970, host: 'localhost'});
```

### Step 3: Update Type References

If you have TypeScript type annotations:

**Before:**
```typescript
function createBroker(): Broker {
  return new Broker();
}
```

**After:**
```typescript
import {Broker1} from 'live-mutex';
function createBroker(): Broker1 {
  return new Broker1();
}
```

### Step 4: Test Your Application

After migrating, thoroughly test your application:

```bash
# Run your test suite
npm test

# Test broker functionality
lmx-quick-start test

# Test RW locks
lmx-test rw
```

## Backward Compatibility

### Current State

- Both `Broker` and `Broker1` are exported from the main module
- Both are fully functional and tested
- Clients work with either broker implementation
- No breaking API changes between the two

### Future Plans

- `Broker1` will continue to be the primary implementation
- `Broker` may be deprecated in a future major version
- Migration path will be provided with advance notice

## Why Two Implementations?

The two implementations exist due to:
1. **Historical reasons**: `Broker` was the original implementation
2. **Refactoring**: `Broker1` was created during a refactoring effort
3. **Testing**: Both are maintained to ensure compatibility
4. **Gradual migration**: Allows users to migrate at their own pace

## Recommendations

### For New Projects

**Use `Broker1`** - It's the recommended implementation for all new projects:

```typescript
import {Broker1, Client} from 'live-mutex';

const broker = new Broker1({port: 6970});
await broker.ensure();
```

### For Existing Projects

1. **If using `Broker`**: Consider migrating to `Broker1` when convenient
2. **If using `Broker1`**: Continue using it - no action needed
3. **If unsure**: Check your imports - if you see `Broker1`, you're already using the recommended version

### For CLI Tools

The CLI tools use `Broker1` by default:

```bash
lmx-quick-start start  # Uses Broker1 internally
lmx start              # Uses Broker1 internally
```

## Testing Both Implementations

If you want to test both implementations:

```typescript
import {Broker, Broker1} from 'live-mutex';

// Test with Broker
const broker1 = new Broker({port: 6970});
await broker1.ensure();

// Test with Broker1
const broker2 = new Broker1({port: 6971});
await broker2.ensure();
```

## FAQ

### Q: Do I need to migrate immediately?

**A:** No. Both implementations are fully functional. Migrate when convenient.

### Q: Will `Broker` be removed?

**A:** Not in the immediate future. Any deprecation will be announced well in advance.

### Q: Are there performance differences?

**A:** No significant performance differences. Both implementations have similar performance characteristics.

### Q: Can clients connect to either broker?

**A:** Yes. Clients are compatible with both `Broker` and `Broker1`.

### Q: Which one should I use in production?

**A:** Use `Broker1` for new deployments. If you're already using `Broker` and it's working, you can continue using it.

## Getting Help

If you encounter issues during migration:

1. Check the [main README](./readme.md) for usage examples
2. Review [readme-2.md](./readme-2.md) for detailed usage guide
3. Run tests: `lmx-quick-start test`
4. Check broker status: `lmx status`

## Summary

- **Current recommendation**: Use `Broker1`
- **Migration**: Simple import change
- **Compatibility**: Both work identically
- **Future**: `Broker1` is the long-term solution

