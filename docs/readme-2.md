# Live-Mutex Usage Guide

This is a practical, accurate guide for using Live-Mutex in your projects.

## Quick Start

### Option 1: Using CLI Tools (Recommended for First-Time Users)

```bash
# Install globally
npm i -g live-mutex

# Check if broker is running
lmx-quick-start check

# Start a broker
lmx-quick-start start

# In another terminal, test the connection
lmx-quick-start test

# Check broker status
lmx status

# Test connection with RW locks
lmx-test rw
```

### Option 2: Using Docker

```bash
# Pull and run the broker
docker pull oresoftware/live-mutex-broker:latest
docker run -d -p 6970:6970 --name lmx-broker oresoftware/live-mutex-broker:latest

# View logs
docker logs -f lmx-broker

# Test the connection
lmx-quick-start test
```

### Option 3: Programmatic Setup

```typescript
import {Broker1, Client} from 'live-mutex';

// Start broker
const broker = new Broker1({port: 6970, host: 'localhost'});
await broker.ensure();

// Create client
const client = new Client({port: 6970, host: 'localhost'});
await client.ensure();
```

## Basic Usage

### Simple Lock/Unlock

```typescript
import {Client} from 'live-mutex';

const client = new Client({port: 6970, host: 'localhost'});

async function example() {
  await client.ensure();
  
  // Acquire lock
  const {key, id} = await client.acquire('my-lock-key');
  
  try {
    // Your critical section code here
    console.log('Doing work with lock...');
  } finally {
    // Always release the lock
    await client.release(key, {id});
  }
}

example().catch(console.error);
```

### Using Callbacks

```typescript
import {Client} from 'live-mutex';

const client = new Client({port: 6970, host: 'localhost'});

client.ensure((err, c) => {
  if (err) return console.error(err);
  
  c.acquire('my-lock-key', (err, {key, id}) => {
    if (err) return console.error(err);
    
    // Your critical section code here
    console.log('Doing work with lock...');
    
    c.release(key, {id}, (err) => {
      if (err) return console.error(err);
      console.log('Lock released');
    });
  });
});
```

## Read-Write Locks

Live-Mutex supports read-write locks with write preference. Multiple readers can coexist, but writers are exclusive.

```typescript
import {RWLockWritePrefClient} from 'live-mutex';

const client = new RWLockWritePrefClient({port: 6970, host: 'localhost'});

async function example() {
  await client.ensure();
  
  // Acquire read lock (multiple readers can coexist)
  const releaseRead = await client.acquireReadLockp('my-key');
  try {
    // Read operations - multiple readers can do this simultaneously
    console.log('Reading data...');
  } finally {
    await new Promise((resolve, reject) => {
      releaseRead((err) => err ? reject(err) : resolve());
    });
  }
  
  // Acquire write lock (exclusive - blocks all readers and writers)
  const releaseWrite = await client.acquireWriteLockp('my-key');
  try {
    // Write operations - exclusive access
    console.log('Writing data...');
  } finally {
    await new Promise((resolve, reject) => {
      releaseWrite((err) => err ? reject(err) : resolve());
    });
  }
}

example().catch(console.error);
```

## Configuration Options

### Client Options

```typescript
const client = new Client({
  port: 6970,                    // Broker port
  host: 'localhost',             // Broker host
  ttl: 10000,                    // Lock time-to-live in ms (default: 30000)
  lockRequestTimeout: 3000,       // Timeout for lock requests (default: 3000)
  maxRetries: 3,                 // Max retries for lock acquisition (default: 3)
  retry: true,                   // Enable retries (default: true)
  env: false                     // Use environment variables (default: false)
});
```

### Broker Options

```typescript
const broker = new Broker1({
  port: 6970,                    // Listen port
  host: '0.0.0.0',              // Listen host
  lockExpiresAfter: 30000,       // Lock expiration time in ms
  timeoutToFindNewLockholder: 5000, // Timeout to find new lockholder
  udsPath: '/tmp/lmx.sock',      // Unix Domain Socket path (optional)
  noDelay: true                  // TCP noDelay option
});
```

## Environment Variables

You can configure clients using environment variables:

```bash
export LMX_PORT=6970
export LMX_HOST=localhost
```

Then use `{env: true}` in your client:

```typescript
const client = new Client({env: true});
```

Or use the CLI to set them:

```bash
lmx set port 6970
lmx set host localhost
```

## Unix Domain Sockets (UDS)

For single-machine deployments, UDS provides better performance:

```typescript
const broker = new Broker1({
  udsPath: '/tmp/lmx-broker.sock'
});

const client = new Client({
  udsPath: '/tmp/lmx-broker.sock'
});
```

**Note:** When using UDS, both broker and client must use the same path, and `host`/`port` are ignored.

## Error Handling

```typescript
try {
  const {key, id} = await client.acquire('my-key', {
    lockRequestTimeout: 5000,
    maxRetries: 3
  });
  
  // Critical section
} catch (err) {
  if (err.code === 'LMXLockRequestError') {
    console.error('Failed to acquire lock:', err.message);
  } else {
    console.error('Unexpected error:', err);
  }
}
```

## Common Patterns

### Rate Limiting

Use `max` option to allow multiple concurrent lockholders:

```typescript
// Allow up to 5 concurrent operations
const {key, id} = await client.acquire('rate-limit-key', {max: 5});
```

### Lock with Timeout

```typescript
const {key, id} = await client.acquire('my-key', {
  ttl: 5000,  // Lock expires after 5 seconds
  lockRequestTimeout: 2000  // Wait up to 2 seconds to acquire
});
```

### Force Unlock

```typescript
// Unlock even if you don't have the lock ID (use with caution)
await client.release('my-key', {force: true});
```

## CLI Commands Reference

```bash
# Quick start commands
lmx-quick-start check          # Check if broker is running
lmx-quick-start start          # Start a broker
lmx-quick-start test           # Test lock acquisition/release
lmx-quick-start docker         # Show Docker commands
lmx-quick-start examples       # Show code examples

# Status and testing
lmx status                     # Check broker status
lmx-test                       # Test basic connection
lmx-test rw                    # Test RW locks

# Lock operations
lmx acquire <key>             # Acquire a lock
lmx release <key>              # Release a lock
lmx ls                         # List active locks

# Broker management
lmx start                      # Start broker
lmx inspect                    # Interactive broker inspection
```

## Best Practices

1. **Always release locks**: Use try/finally blocks to ensure locks are released
2. **Set appropriate TTLs**: Don't rely solely on TTL - always release explicitly
3. **Handle errors**: Lock acquisition can fail - handle errors appropriately
4. **Use RW locks for read-heavy workloads**: Multiple readers improve concurrency
5. **Monitor broker health**: Use `lmx status` to check broker status
6. **Use UDS for single-machine**: Better performance than TCP on same machine
7. **Set timeouts**: Use `lockRequestTimeout` to avoid indefinite waits

## Troubleshooting

### Broker not responding

```bash
# Check if broker is running
lmx-quick-start check

# Check broker status
lmx status

# View broker logs (if using Docker)
docker logs lmx-broker
```

### Connection errors

- Verify broker is running on the expected port
- Check firewall settings
- Ensure host/port match between client and broker

### Lock timeouts

- Increase `lockRequestTimeout`
- Check if locks are being released properly
- Verify broker is not overloaded

## Migration from Broker to Broker1

See [BROKER_MIGRATION.md](./BROKER_MIGRATION.md) for details on migrating from `Broker` to `Broker1`.

## Additional Resources

- [Detailed Explanation](./docs/detailed-explanation.md)
- [Examples](./docs/examples/)
- [RW Lock Testing](./docs/testing-rw-locks.md)
- [Docker Guide](./docs/getting-started-with-docker.md)

