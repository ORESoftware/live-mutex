#!/usr/bin/env node

/**
 * Simple, reliable test runner for live-mutex
 * Runs tests serially, each with its own independent broker on a unique port
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE_PORT = 9000;
const TEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per test
let currentPort = BASE_PORT;

// Test files to run (in order)
const TEST_FILES = [
  'test/semaphore-test.js',
  'test/simple-test.js',
  'test/rw-lock-file-test-local.js',
  'test/comprehensive-rw-lock-test.js',
  'test/standard-client-semaphore-test.js',
];

// Also find any other standalone test files
function findTestFiles() {
  const testDir = path.join(__dirname, '..', 'test');
  const files = fs.readdirSync(testDir);
  const testFiles = [];
  
  for (const file of files) {
    if (file.endsWith('-test.js') || file.endsWith('-test.ts')) {
      const fullPath = path.join(testDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        testFiles.push(path.relative(process.cwd(), fullPath));
      }
    }
  }
  
  return testFiles;
}

function getNextPort() {
  return currentPort++;
}

function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running: ${testFile}`);
    console.log(`${'='.repeat(80)}\n`);
    // Force flush
    process.stdout.write('');
    
    const startTime = Date.now();
    const testPort = getNextPort();
    let timeoutId = null;
    let killTimeoutId = null;
    let resolved = false;
    let outputBuffer = '';
    let errorBuffer = '';
    
    // Set environment variables for the test
    const env = {
      ...process.env,
      LMX_TEST_PORT: testPort.toString(),
      LMX_TEST_BASE_PORT: BASE_PORT.toString(),
      // Enable log capture
      LMX_CAPTURE_LOGS: '1',
      // Ensure non-interactive mode
      CI: 'true',
      FORCE_COLOR: '0',
    };
    
    // Determine if it's TypeScript or JavaScript
    const isTypeScript = testFile.endsWith('.ts');
    const command = isTypeScript ? 'npx' : 'node';
    const args = isTypeScript ? ['ts-node', testFile] : [testFile];
    
    // Use pipe instead of inherit for better control
    const proc = spawn(command, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..'),
      detached: false,
    });
    
    // Capture stdout
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      outputBuffer += text;
      // Write to parent stdout immediately for real-time viewing
      process.stdout.write(text);
    });
    
    // Capture stderr
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      errorBuffer += text;
      // Write to parent stderr immediately
      process.stderr.write(text);
    });
    
    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error(`\n⏱️  ${testFile} timed out after ${TEST_TIMEOUT_MS / 1000}s`);
        
        // Try graceful shutdown first
        try {
          proc.kill('SIGTERM');
        } catch (e) {
          // ignore
        }
        
        // Force kill after a grace period
        killTimeoutId = setTimeout(() => {
          try {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
            // Also kill any child processes
            if (proc.pid) {
              try {
                process.kill(-proc.pid, 'SIGKILL');
              } catch (e) {
                // ignore
              }
            }
          } catch (e) {
            // ignore
          }
        }, 3000);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        resolve({ file: testFile, passed: false, duration, timeout: true });
      }
    }, TEST_TIMEOUT_MS);
    
    const finish = (code, timeout = false) => {
      if (resolved) return;
      resolved = true;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (killTimeoutId) {
        clearTimeout(killTimeoutId);
      }
      
      // Ensure process is dead
      try {
        if (!proc.killed && proc.pid) {
          try {
            process.kill(proc.pid, 0); // Check if alive
            proc.kill('SIGTERM');
            setTimeout(() => {
              if (!proc.killed) {
                proc.kill('SIGKILL');
              }
            }, 1000);
          } catch (e) {
            // Process already dead
          }
        }
      } catch (e) {
        // ignore
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      if (code === 0 && !timeout) {
        console.log(`\n✅ ${testFile} passed (${duration}s)`);
        resolve({ file: testFile, passed: true, duration });
      } else {
        const reason = timeout ? ' (timeout)' : ` (exit code: ${code})`;
        console.log(`\n❌ ${testFile} failed${reason} (${duration}s)`);
        resolve({ file: testFile, passed: false, duration, code, timeout });
      }
    };
    
    proc.on('close', (code, signal) => {
      // Small delay to ensure all output is flushed
      setTimeout(() => {
        finish(code === null ? 1 : code);
      }, 100);
    });
    
    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (killTimeoutId) {
          clearTimeout(killTimeoutId);
        }
        console.error(`\n❌ Error running ${testFile}:`, err.message);
        reject(err);
      }
    });
    
    // Handle process exit to ensure cleanup
    const cleanup = () => {
      if (!resolved && proc && !proc.killed) {
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          }, 1000);
        } catch (e) {
          // ignore
        }
      }
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}

async function main() {
  console.log('🧪 Live-Mutex Test Runner');
  console.log('='.repeat(80));
  console.log('Running tests serially with independent brokers\n');
  
  // Ensure dist is built
  try {
    console.log('Building TypeScript...');
    execSync('npx tsc', { 
      stdio: 'pipe',
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    console.log('✅ Build complete\n');
  } catch (err) {
    console.error('❌ Build failed:', err.message);
    if (err.stdout) console.error('STDOUT:', err.stdout);
    if (err.stderr) console.error('STDERR:', err.stderr);
    process.exit(1);
  }
  
  // Get all test files
  const allTestFiles = [...TEST_FILES];
  const foundTests = findTestFiles();
  
  // Add found tests that aren't already in the list
  for (const test of foundTests) {
    if (!allTestFiles.includes(test) && !test.includes('@src') && !test.includes('@target')) {
      allTestFiles.push(test);
    }
  }
  
  // Filter to only files that exist
  const existingTests = allTestFiles.filter(file => {
    const fullPath = path.join(__dirname, '..', file);
    return fs.existsSync(fullPath);
  });
  
  console.log(`Found ${existingTests.length} test file(s) to run\n`);
  
  const results = [];
  
  // Run tests serially
  for (const testFile of existingTests) {
    try {
      const result = await runTest(testFile);
      results.push(result);
      
      // Small delay between tests to ensure ports are released
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`Fatal error running ${testFile}:`, err);
      results.push({ file: testFile, passed: false, error: err.message });
      // Continue with next test
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Test Summary');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  console.log(`Total: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total time: ${totalDuration.toFixed(2)}s\n`);
  
  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      const reasons = [];
      if (r.timeout) reasons.push('timeout');
      if (r.code) reasons.push(`exit code: ${r.code}`);
      if (r.error) reasons.push(`error: ${r.error}`);
      const reasonStr = reasons.length > 0 ? ` (${reasons.join(', ')})` : '';
      console.log(`  ❌ ${r.file}${reasonStr}`);
    });
    console.log();
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

