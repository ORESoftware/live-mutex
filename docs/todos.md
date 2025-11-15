# Live-Mutex TODO List

## High Priority

### Convert `resolutions` object to Map

**Status**: Pending  
**Priority**: High  
**Files Affected**: 
- `src/client.ts`
- `src/rw-write-preferred-client.ts`
- `src/rw-client.ts` (if applicable)

**Description**:  
Convert the `resolutions` property from a Plain Old JavaScript Object (POJO) to a JavaScript/TypeScript `Map` for better performance and type safety.

**Current Implementation**:
```typescript
export interface IClientResolution {
  [key: string]: EVCb<any>
}

// In Client class:
resolutions: IClientResolution;
// Initialized as: this.resolutions = {};
// Accessed as: this.resolutions[uuid]
// Set as: this.resolutions[uuid] = callback
// Deleted as: delete this.resolutions[uuid]
// Cleared as: this.resolutions = {}
```

**Target Implementation**:
```typescript
// In Client class:
resolutions: Map<string, EVCb<any>>;
// Initialized as: this.resolutions = new Map()
// Accessed as: this.resolutions.get(uuid)
// Set as: this.resolutions.set(uuid, callback)
// Deleted as: this.resolutions.delete(uuid)
// Cleared as: this.resolutions.clear()
```

**Changes Required**:
1. Update type definition from `IClientResolution` interface to `Map<string, EVCb<any>>`
2. Change initialization from `this.resolutions = {}` to `this.resolutions = new Map()`
3. Replace all `this.resolutions[uuid]` access with `this.resolutions.get(uuid)`
4. Replace all `this.resolutions[uuid] = callback` with `this.resolutions.set(uuid, callback)`
5. Replace all `delete this.resolutions[uuid]` with `this.resolutions.delete(uuid)`
6. Replace all `this.resolutions = {}` with `this.resolutions.clear()`
7. Update any checks like `if (this.resolutions[uuid])` to `if (this.resolutions.has(uuid))`
8. Remove or update the `IClientResolution` interface if no longer needed

**Locations to Update** (based on grep results):
- `src/client.ts`: ~20+ occurrences
- `src/rw-write-preferred-client.ts`: ~5 occurrences
- Check `src/rw-client.ts` for similar usage

**Benefits**:
- Better performance for frequent add/delete operations
- Type safety with Map API
- Consistent with other Map usage in the codebase (e.g., `locks`, `wsToUUIDs`, `wsToKeys` in Broker classes)
- More explicit API (get/set/delete vs bracket notation)

**Testing**:
- Ensure all tests pass after conversion
- Verify no performance regression
- Check that all resolution callbacks are still properly called

**Notes**:
- The broker classes already use Maps for similar data structures (`locks`, `wsToUUIDs`, `wsToKeys`)
- This change will improve consistency across the codebase
- Consider doing this refactor in a separate branch for easier review

---

## Medium Priority

_(Add other todos here as needed)_

---

## Low Priority

_(Add other todos here as needed)_

---

## Completed

_(Move completed items here with completion date)_

