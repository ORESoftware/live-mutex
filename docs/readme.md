# Live-Mutex Usage Guide

This is a practical usage guide for Live-Mutex. For general information, see [readme.md](../readme.md).

## Quick Start

### 1. Install the Package

```bash
npm install live-mutex
```

For CLI tools:
```bash
npm install -g live-mutex
```

### 2. Start a Broker

You have three options:

#### Option A: Using CLI (Development)
```bash
lmx start
# or
lmx_start_server
```

#### Option B: Using Docker (Production)
```bash
docker pull oresoftware/live-mutex-broker:latest
docker run -d -p 6970:6970 --name lmx-broker oresoftware/live-mutex-broker:latest
```

#### Option C: Programmatically
```typescript
import {Broker1} from 'live-mutex';

const broker = new Broker1({port: 6970, host: '0.0.0.0'});
await broker.ensure();
console.log('Broker is running on port 6970');
```

### 3. Verify Broker is Running

```bash
lmx status
# or
lmx health-check
```

### 4. Use in Your Code

```typescript
import {Client} from 'live-mutex';

const client = new Client({port: 6970, host: 'localhost'});

async function doWork() {
  await client.ensure();
  
  const {id, key} = await client.acquire('my-lock-key');
  try {
    // Your critical section code here
    console.log('Doing work with lock...');
  } finally {
    await client.release(key, id);
  }
}

doWork();
```

## CLI Commands

### Getting Started Commands

- `lmx quick-start` - Interactive guide to get started
- `lmx status [port] [host]` - Check if broker is running
- `lmx health-check [port] [host]` - Run a health check (acquires/releases a test lock)

### Broker Management

- `lmx start` - Start a broker server
- `lmx launch` - Alias for `lmx start`

### Lock Operations

- `lmx acquire <key> [port]` - Acquire a lock (blocks until acquired)
- `lmx release <key> [port]` - Release a lock

### Inspection

- `lmx ls` - List all active locks
- `lmx inspect` - Interactive broker inspection tool

## Common Usage Patterns

### Basic Locking

```typescript
import {Client} from 'live-mutex';

const client = new Client({port: 6970});

async function example() {
  await client.ensure();
  
  // Acquire lock
  const {id} = await client.acquire('resource-1');
  
  try {
    // Critical section
    await doSomething();
  } finally {
    // Always release
    await client.release('resource-1', id);
  }
}
```

### Lock with Timeout

```typescript
const {id} = await client.acquire('resource-1', {
  ttl: 5000,  // Lock expires after 5 seconds
  lockRequestTimeout: 2000,  // Wait max 2 seconds to acquire
  maxRetries: 3  // Retry 3 times
});
```

### Non-Binary Semaphore (Multiple Lockholders)

```typescript
// Allow up to 5 concurrent lockholders
const {id} = await client.acquire('resource-1', {
  max: 5
});
```

### Using Callbacks (Lower-level API)

```typescript
client.ensure((err) => {
  if (err) throw err;
  
  client.lock('resource-1', (err, unlock) => {
    if (err) throw err;
    
    // Do work
    doSomething(() => {
      unlock((err) => {
        if (err) console.error('Unlock error:', err);
      });
    });
  });
});
```

## Configuration Options

### Client Options

```typescript
const client = new Client({
  port: 6970,                    // Broker port (default: 6970)
  host: 'localhost',             // Broker host (default: 'localhost')
  ttl: 4000,                      // Default TTL for locks (ms)
  lockRequestTimeout: 3000,      // Timeout per lock request (ms)
  maxRetries: 3,                 // Max retries for lock acquisition
  noDelay: true,                 // TCP_NODELAY option
  udsPath: '/path/to/socket',    // Use Unix Domain Socket instead of TCP
  env: false                     // Read config from environment variables
});
```

### Lock Options

```typescript
await client.acquire('key', {
  ttl: 5000,                      // Lock expiration time (ms)
  max: 1,                         // Max concurrent lockholders (default: 1)
  lockRequestTimeout: 2000,       // Request timeout (ms)
  maxRetries: 3,                  // Max retries
  keepLocksAfterDeath: false,     // Keep lock if client dies
  keepLocksOnExit: false          // Keep lock on client exit
});
```

### Release Options

```typescript
await client.release('key', id, {
  force: false,                   // Force release (ignore id)
  unlockRequestTimeout: 1000      // Unlock request timeout
});
```

## Best Practices

1. **Always use try/finally** to ensure locks are released:
   ```typescript
   const {id} = await client.acquire('key');
   try {
     // work
   } finally {
     await client.release('key', id);
   }
   ```

2. **Set appropriate TTLs** to prevent deadlocks:
   ```typescript
   await client.acquire('key', {ttl: 10000}); // 10 second max
   ```

3. **Use `client.ensure()`** before first use:
   ```typescript
   await client.ensure(); // Ensures connection is ready
   ```

4. **Handle errors gracefully**:
   ```typescript
   try {
     const {id} = await client.acquire('key');
   } catch (err) {
     if (err instanceof LMXLockRequestError) {
       // Lock acquisition failed
     }
   }
   ```

5. **Use Unix Domain Sockets for single-machine performance**:
   ```typescript
   const client = new Client({udsPath: '/tmp/lmx.sock'});
   ```

## Docker Usage

### Basic Docker Setup

```bash
# Pull and run
docker pull oresoftware/live-mutex-broker:latest
docker run -d -p 6970:6970 --name lmx-broker oresoftware/live-mutex-broker:latest

# View logs
docker logs -f lmx-broker

# Stop
docker stop lmx-broker

# Remove
docker rm lmx-broker
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  lmx-broker:
    image: oresoftware/live-mutex-broker:latest
    ports:
      - "6970:6970"
    restart: unless-stopped
```

### Custom Port

```bash
docker run -d -p 8080:8080 \
  -e live_mutex_port=8080 \
  oresoftware/live-mutex-broker:latest
```

## Troubleshooting

### Broker Not Running

```bash
# Check status
lmx status

# Start broker
lmx start
```

### Connection Errors

- Verify broker is running: `lmx status`
- Check firewall settings
- Verify port is correct: `lmx status 6970 localhost`

### Lock Timeouts

- Increase `lockRequestTimeout`
- Increase `maxRetries`
- Check if another process is holding the lock: `lmx ls`

### Performance Issues

- Use Unix Domain Sockets for single-machine setups
- Consider using multiple brokers for different keys
- Monitor broker with `lmx inspect`

## Advanced Topics

### Read-Write Locks

Live-Mutex supports read-write locks through specialized clients:

```typescript
import {RWLockWritePrefClient} from 'live-mutex';

const rwClient = new RWLockWritePrefClient({port: 6970});
await rwClient.ensure();

// Write lock
const {id} = await rwClient.acquireWrite('resource');
await rwClient.releaseWrite('resource', id);

// Read lock
const {id} = await rwClient.acquireRead('resource');
await rwClient.releaseRead('resource', id);
```

### Programmatic Broker Launch

```typescript
import {lmUtils} from 'live-mutex';

lmUtils.conditionallyLaunchSocketServer({port: 6970}, (err) => {
  if (err) throw err;
  // Broker is now running (or was already running)
});
```

## See Also

- [readme.md](../readme.md) - General information and rationale
- [BROKER-COMPARISON.md](../BROKER-COMPARISON.md) - Broker vs Broker1 differences
- [MIGRATION-GUIDE.md](../MIGRATION-GUIDE.md) - Migration guide for developers

