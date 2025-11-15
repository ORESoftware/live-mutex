# Migration Guide: Broker to Broker1

This guide helps you migrate from the legacy `Broker` to the recommended `Broker1` implementation.

## Why Migrate?

- **Broker1** is the actively maintained implementation
- **Broker** will be deprecated and eventually removed
- **Broker1** is used by all CLI tools and internal utilities
- Both have identical APIs, so migration is straightforward

## Quick Migration

### Step 1: Update Imports

**Before:**
```typescript
import {Broker} from 'live-mutex';
// or
import {LMXBroker} from 'live-mutex';
```

**After:**
```typescript
import {Broker1} from 'live-mutex';
// or use the alias
import {LMXBroker1} from 'live-mutex';
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

### Step 3: Test Your Code

The APIs are identical, so your existing code should work without any other changes.

## Detailed Migration Examples

### Example 1: Basic Broker Setup

**Before:**
```typescript
import {Broker} from 'live-mutex';

const broker = new Broker({
  port: 6970,
  host: '0.0.0.0'
});

broker.ensure((err) => {
  if (err) {
    console.error('Broker failed to start:', err);
    process.exit(1);
  }
  console.log('Broker is running');
});
```

**After:**
```typescript
import {Broker1} from 'live-mutex';

const broker = new Broker1({
  port: 6970,
  host: '0.0.0.0'
});

broker.ensure((err) => {
  if (err) {
    console.error('Broker failed to start:', err);
    process.exit(1);
  }
  console.log('Broker is running');
});
```

### Example 2: Using Promises

**Before:**
```typescript
import {Broker} from 'live-mutex';

const broker = new Broker({port: 6970});

broker.ensure()
  .then(() => {
    console.log('Broker started');
  })
  .catch((err) => {
    console.error('Broker failed:', err);
  });
```

**After:**
```typescript
import {Broker1} from 'live-mutex';

const broker = new Broker1({port: 6970});

broker.ensure()
  .then(() => {
    console.log('Broker started');
  })
  .catch((err) => {
    console.error('Broker failed:', err);
  });
```

### Example 3: Using Async/Await

**Before:**
```typescript
import {Broker} from 'live-mutex';

async function startBroker() {
  const broker = new Broker({port: 6970});
  await broker.ensure();
  console.log('Broker is running');
}
```

**After:**
```typescript
import {Broker1} from 'live-mutex';

async function startBroker() {
  const broker = new Broker1({port: 6970});
  await broker.ensure();
  console.log('Broker is running');
}
```

### Example 4: With Event Handlers

**Before:**
```typescript
import {Broker} from 'live-mutex';

const broker = new Broker({port: 6970});

broker.emitter.on('error', (err) => {
  console.error('Broker error:', err);
});

broker.emitter.on('warning', (msg) => {
  console.warn('Broker warning:', msg);
});

await broker.ensure();
```

**After:**
```typescript
import {Broker1} from 'live-mutex';

const broker = new Broker1({port: 6970});

broker.emitter.on('error', (err) => {
  console.error('Broker error:', err);
});

broker.emitter.on('warning', (msg) => {
  console.warn('Broker warning:', msg);
});

await broker.ensure();
```

## Migration Checklist

- [ ] Update all `import {Broker}` statements to `import {Broker1}`
- [ ] Update all `new Broker()` calls to `new Broker1()`
- [ ] Update any type annotations from `Broker` to `Broker1`
- [ ] Run your test suite
- [ ] Verify broker functionality in your environment
- [ ] Update documentation/comments that reference `Broker`

## Finding All Usages

### Using grep

```bash
# Find all imports
grep -r "import.*Broker[^1]" src/

# Find all constructor calls
grep -r "new Broker(" src/

# Find all type annotations
grep -r ": Broker" src/
```

### Using TypeScript

If you're using TypeScript, the compiler will help you find all usages when you remove the `Broker` export.

## Common Patterns

### Pattern 1: Factory Functions

**Before:**
```typescript
function createBroker(port: number): Broker {
  return new Broker({port});
}
```

**After:**
```typescript
function createBroker(port: number): Broker1 {
  return new Broker1({port});
}
```

### Pattern 2: Type Aliases

**Before:**
```typescript
type MyBroker = Broker;
const broker: MyBroker = new Broker({port: 6970});
```

**After:**
```typescript
type MyBroker = Broker1;
const broker: MyBroker = new Broker1({port: 6970});
```

### Pattern 3: Static Factory Methods

**Before:**
```typescript
const broker = Broker.create({port: 6970});
```

**After:**
```typescript
const broker = Broker1.create({port: 6970});
```

## Backward Compatibility

During the transition period, both `Broker` and `Broker1` will be available. However, `Broker` will eventually be:

1. **Marked as deprecated** (with warnings in console)
2. **Removed** in a future major version

## Testing After Migration

After migrating, test these scenarios:

1. **Broker startup:**
   ```typescript
   const broker = new Broker1({port: 6970});
   await broker.ensure();
   ```

2. **Lock acquisition/release:**
   ```typescript
   const client = new Client({port: 6970});
   await client.ensure();
   const {id} = await client.acquire('test-key');
   await client.release('test-key', id);
   ```

3. **Error handling:**
   ```typescript
   try {
     await broker.ensure();
   } catch (err) {
     // Handle errors
   }
   ```

## Rollback Plan

If you encounter issues after migration, you can temporarily rollback:

```typescript
// Temporary rollback
import {Broker as Broker1} from 'live-mutex';
```

However, this is not recommended long-term. Instead, report issues so they can be fixed in Broker1.

## Getting Help

If you encounter issues during migration:

1. Check [BROKER-COMPARISON.md](./BROKER-COMPARISON.md) for differences
2. Review the [README-2.md](./README-2.md) for usage examples
3. Open an issue on GitHub with details about your use case

## Timeline

- **Now**: Start migrating to Broker1
- **Next minor version**: Broker will show deprecation warnings
- **Next major version**: Broker will be removed

## Summary

Migration is simple:
1. Change `Broker` to `Broker1` in imports
2. Change `new Broker()` to `new Broker1()`
3. Test your code

The APIs are identical, so no other changes are needed!

