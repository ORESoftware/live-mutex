# Compilation Guide

<<<<<<< HEAD
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
=======
This guide explains how to compile Live-Mutex source code and tests.
>>>>>>> 111df4ddf6ca756705f9e905054c7873e61cc6ce

## Prerequisites

- Node.js >= 8.0.0
<<<<<<< HEAD
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
=======
- TypeScript >= 5.9.3
- npm or yarn

## Installation

```bash
npm install
```

This will install all dependencies including TypeScript.

## Compilation

### Compile Source Code

The main source code is located in `src/` and compiles to `dist/`.

```bash
# Compile TypeScript source files
npm run compile

# Or use TypeScript directly
npx tsc
```

The compiled JavaScript files will be in `dist/` directory.

### Compile Tests

Test files are located in `test/` directory. To compile tests:

```bash
# Compile test files
npm run compile:test

# Or compile manually
npx tsc --project tsconfig.test.json
```

Note: 
- Test files may reference source files from `src/`, so ensure source is compiled first.
- Some test files may have type errors that don't prevent tests from running. The test runner uses the compiled source code and may execute tests even if test compilation shows warnings.

## TypeScript Configuration

### Main Configuration (`tsconfig.json`)

- **Root**: `src/`
- **Output**: `dist/`
- **Target**: ES2020
- **Module**: CommonJS

### Test Configuration (`tsconfig.test.json`)

- **Root**: `test/`
- **Output**: `dist/test/`
- **Includes**: All `.ts` files in `test/` directory

## Compilation Scripts

The following scripts are available in `package.json`:

- `npm run compile` - Compile source code (`src/` → `dist/`)
- `npm run compile:test` - Compile test files (`test/` → `dist/test/`)
- `npm run compile:all` - Compile both source and tests
- `npm run compile:check` - Check compilation without generating files

## Common Issues

### Issue: TypeScript not found

**Solution**: Install TypeScript globally or use npx:
```bash
npm install -g typescript
# or
npx tsc
```

### Issue: Test files don't compile

**Solution**: Ensure source code is compiled first:
```bash
npm run compile
npm run compile:test
```

### Issue: Module not found errors

**Solution**: Ensure all dependencies are installed:
```bash
npm install
```

### Issue: Declaration files missing

**Solution**: The `tsconfig.json` includes `"declaration": true`, which generates `.d.ts` files. Ensure compilation completes successfully.

## Development Workflow

1. **Make changes** to source files in `src/`
2. **Compile** the code:
   ```bash
   npm run compile
   ```
3. **Test** your changes:
   ```bash
   npm test
   ```
4. **Commit** your changes

## Continuous Integration

The project uses CI/CD pipelines that automatically:
1. Install dependencies
2. Compile source code
3. Compile tests
4. Run tests

See `.travis.yml` and `.circleci/` for CI configuration.

## File Structure

```
live-mutex/
├── src/              # Source TypeScript files
│   ├── *.ts
│   └── ...
├── test/             # Test TypeScript files
│   ├── *.ts
│   └── ...
├── dist/             # Compiled JavaScript (generated)
│   ├── *.js
│   ├── *.d.ts
│   └── test/
│       └── ...
├── tsconfig.json     # Main TypeScript config
├── tsconfig.test.json # Test TypeScript config
└── package.json
```

## Type Checking Without Compilation

To check for TypeScript errors without generating files:

```bash
npm run compile:check
```

This is useful for:
- Quick error checking
- CI/CD pipelines
- Pre-commit hooks

## Watch Mode

For development, you can use TypeScript's watch mode:

```bash
# Watch source files
npx tsc --watch

# Watch test files
npx tsc --watch --project tsconfig.test.json
```

## Troubleshooting

### Clean Build

If you encounter compilation issues, try a clean build:

```bash
# Remove compiled files
rm -rf dist/

# Recompile
npm run compile
npm run compile:test
```

### Type Errors

If you see type errors:
1. Check that all dependencies are installed
2. Ensure TypeScript version matches `package.json`
3. Check `tsconfig.json` settings
4. Review error messages for specific issues

### Missing Type Definitions

Some packages may need type definitions:

```bash
npm install --save-dev @types/package-name
```

## Best Practices

1. **Always compile before committing** - Ensure code compiles without errors
2. **Run tests after compilation** - Verify functionality
3. **Use strict mode** - The project uses `noImplicitAny: true` for type safety
4. **Check declarations** - Ensure `.d.ts` files are generated correctly
5. **Keep configs in sync** - If you modify `tsconfig.json`, ensure tests still compile

## Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig)
- [Project README](./../README.md)
- [Usage Guide](./../README-2.md)
>>>>>>> 111df4ddf6ca756705f9e905054c7873e61cc6ce

