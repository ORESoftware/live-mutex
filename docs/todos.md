# Todos

## Move resolutions object to Map

### Current State
The `resolutions` object in `src/client.ts` is currently implemented as a Plain Old JavaScript Object (POJO):
- Defined as `IClientResolution` interface: `{ [key: string]: EVCb<any> }`
- Initialized as `this.resolutions = {}` in the constructor
- Used throughout the codebase with object property access patterns

### Task
Convert `resolutions` from a POJO to a JavaScript/TypeScript `Map<string, EVCb<any>>` for:
- Better performance with frequent additions/deletions
- More explicit key-value semantics
- Type safety improvements

### Files to Update
- `src/client.ts` - Main client implementation
  - Update `IClientResolution` interface or replace with Map type
  - Change initialization from `{}` to `new Map()`
  - Update all access patterns:
    - `this.resolutions[uuid]` → `this.resolutions.get(uuid)`
    - `this.resolutions[uuid] = fn` → `this.resolutions.set(uuid, fn)`
    - `delete this.resolutions[uuid]` → `this.resolutions.delete(uuid)`
    - `Object.keys(this.resolutions)` → `Array.from(this.resolutions.keys())`
    - `Object.entries(this.resolutions)` → `Array.from(this.resolutions.entries())`
    - `this.resolutions = {}` → `this.resolutions.clear()` or `new Map()`

- `src/rw-write-preferred-client.ts` - RW client implementation
  - Similar updates needed if it also uses resolutions

- `src/client.js` - Generated JavaScript (will be updated on rebuild)

### Considerations
- Ensure all usages are updated (grep shows ~70 occurrences)
- Test thoroughly as this is a core data structure
- Consider if other similar objects (timeouts, giveups, timers) should also be converted

