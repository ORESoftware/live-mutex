# Compilation Guide

This guide explains how to compile Live-Mutex source code and tests.

## Prerequisites

- Node.js >= 8.0.0
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

