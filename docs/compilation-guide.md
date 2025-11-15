# Compilation Guide

This guide explains how to compile Live-Mutex from TypeScript source code.

## Quick Start

```bash
# Compile all TypeScript files
npm run compile

# Compile and watch for changes
npm run compile:watch

# Compile tests
npm run compile:tests
```

## Prerequisites

- Node.js >= 8.0.0
- npm or yarn
- TypeScript (installed as dev dependency)

## Compilation Commands

### Main Source Code

Compile the main TypeScript source files:

```bash
npm run compile
```

This compiles all `.ts` files in `src/` and `assets/cli/` to JavaScript in `dist/` and `assets/cli/`.

### Test Files

Compile test files to verify they have no TypeScript errors:

```bash
npm run compile:tests
```

This checks all test files in `test/` for compilation errors without generating output files.

### Watch Mode

For development, use watch mode to automatically recompile on changes:

```bash
npm run compile:watch
```

## TypeScript Configuration

The project uses `tsconfig.json` for TypeScript configuration. Key settings:

- **Target**: ES2015+ (for modern JavaScript features)
- **Module**: CommonJS (for Node.js compatibility)
- **Source Maps**: Enabled for debugging
- **Strict Mode**: Enabled for type safety

## Output Directories

- **`dist/`** - Compiled JavaScript from `src/`
- **`assets/cli/*.js`** - Compiled CLI tools from `assets/cli/*.ts`
- **`test/@target/`** - Compiled test files (if using Suman)

## Compilation Process

1. **Type Checking**: TypeScript validates all types
2. **Transpilation**: TypeScript code is converted to JavaScript
3. **Source Maps**: Generated for debugging support
4. **Declaration Files**: `.d.ts` files generated for type definitions

## Common Issues

### Type Errors

If you see type errors:

```bash
# Check specific file
npx tsc --noEmit path/to/file.ts

# Check all files
npx tsc --noEmit
```

### Missing Dependencies

If compilation fails due to missing types:

```bash
npm install --save-dev @types/node
```

### Outdated Build

If you see runtime errors that suggest old code:

```bash
# Clean and rebuild
rm -rf dist/ assets/cli/*.js
npm run compile
```

## Integration with Tests

Tests can be run directly with TypeScript using `ts-node` or `tsx`:

```bash
# Using ts-node
npx ts-node test/my-test.ts

# Using tsx (faster)
npx tsx test/my-test.ts
```

The test runner (`scripts/run-tests.js`) automatically compiles TypeScript before running tests.

## CI/CD Integration

For continuous integration, ensure compilation succeeds:

```bash
# In CI pipeline
npm install
npm run compile
npm run compile:tests  # Verify tests compile
npm test
```

## Development Workflow

1. **Make changes** to `.ts` files
2. **Compile** with `npm run compile` or use watch mode
3. **Test** your changes
4. **Commit** both `.ts` and compiled `.js` files

## Best Practices

1. **Always compile before committing** - Ensure JavaScript files are up to date
2. **Check test compilation** - Run `npm run compile:tests` before pushing
3. **Use watch mode for development** - Faster iteration during development
4. **Fix type errors immediately** - Don't ignore TypeScript errors
5. **Keep source maps** - They help with debugging

## Troubleshooting

### "Cannot find module" errors

- Ensure all dependencies are installed: `npm install`
- Check that `dist/` directory exists after compilation
- Verify import paths match the compiled structure

### "Type is not assignable" errors

- Check TypeScript version: `npx tsc --version`
- Review type definitions in `src/`
- Ensure strict mode settings are appropriate

### Slow compilation

- Use incremental compilation: `tsc --incremental`
- Consider using `tsx` for faster test execution
- Exclude unnecessary files in `tsconfig.json`

## Related Documentation

- [Main README](../readme.md)
- [Usage Guide](../readme-2.md)
- [Testing Guide](./testing-rw-locks.md)

