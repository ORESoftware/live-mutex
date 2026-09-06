# BaseClient/BaseBroker Migration Notes

## Current Architecture

The codebase currently has:
- **Client** (`src/client.ts`) - Regular lock client, uses `max` only
- **RWLockWritePrefClient** (`src/rw-write-preferred-client.ts`) - RW lock client, uses `maxRead`/`maxWrite`
- **Broker** (`src/broker.ts`) - Standard broker
- **Broker1** (`src/broker-1.ts`) - Alternative broker implementation

Both brokers handle both regular locks and RW locks on the same server instance.

## Potential Future Refactoring

### BaseClient Architecture

**Goal:** Reduce code duplication between `Client` and RW client classes.

**Proposed Structure:**
```
BaseClient (abstract or base class)
├── Common functionality:
│   ├── Connection management
│   ├── Socket handling
│   ├── Lock request/response handling
│   ├── Error handling
│   └── Event emission
│
├── Client extends BaseClient
│   └── Regular lock methods (uses `max` only)
│
└── RWLockWritePrefClient extends BaseClient
    └── RW lock methods (uses `maxRead`/`maxWrite`)
```

**Benefits:**
- Eliminate code duplication in connection/socket handling
- Centralize common client logic
- Easier to maintain and extend
- Clear separation of concerns

**Considerations:**
- Need to ensure backward compatibility
- May require careful handling of different lock types
- Should maintain current API surface

### BaseBroker Architecture

**Goal:** Reduce code duplication between `Broker` and `Broker1`.

**Proposed Structure:**
```
BaseBroker (abstract or base class)
├── Common functionality:
│   ├── Lock storage and management
│   ├── Socket handling
│   ├── Lock granting logic
│   ├── Max limit enforcement (handles both `max` and `maxRead`/`maxWrite`)
│   └── Event emission
│
├── Broker extends BaseBroker
│   └── Standard broker implementation
│
└── Broker1 extends BaseBroker
    └── Alternative broker implementation (if still needed)
```

**Benefits:**
- Eliminate ~1700+ lines of duplicated code
- Single source of truth for lock management logic
- Easier to maintain and test
- Consistent behavior across broker implementations

**Considerations:**
- Large refactoring effort
- Need to ensure both broker types still work correctly
- May want to deprecate one broker type if they're functionally equivalent
- Should maintain backward compatibility

## Current Status

**Decision:** Keep current structure for now.

**Rationale:**
- Current code works correctly
- Both broker types handle regular and RW locks properly
- No immediate need for refactoring
- Can be done as a future improvement

## Migration Checklist (if/when implementing)

### BaseClient Migration
- [ ] Create `BaseClient` class with common functionality
- [ ] Refactor `Client` to extend `BaseClient`
- [ ] Refactor `RWLockWritePrefClient` to extend `BaseClient`
- [ ] Update all tests to ensure compatibility
- [ ] Update documentation

### BaseBroker Migration
- [ ] Analyze differences between `Broker` and `Broker1`
- [ ] Create `BaseBroker` class with shared functionality
- [ ] Refactor `Broker` to extend `BaseBroker`
- [ ] Refactor `Broker1` to extend `BaseBroker` (or deprecate if redundant)
- [ ] Update all tests to ensure compatibility
- [ ] Update documentation
- [ ] Consider consolidating to single broker type if possible

## Notes

- Both brokers currently handle both regular locks (`max`) and RW locks (`maxRead`/`maxWrite`) correctly
- The broker detects lock type via `beginRead !== undefined` (RW locks) vs `undefined` (regular locks)
- Regular clients send `max` only
- RW clients send `maxRead` and `maxWrite`
- This separation works well and doesn't require immediate refactoring

