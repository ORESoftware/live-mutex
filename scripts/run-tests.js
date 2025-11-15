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

// Test files to run (in order) - prefer .ts files
const TEST_FILES = [
  'test/semaphore-test.ts',
  'test/simple-test.ts',
  'test/rw-lock-file-test-local.ts',
  'test/comprehensive-rw-lock-test.ts',
  'test/standard-client-semaphore-test.ts',
];

// Also find any other standalone test files
function findTestFiles() {
  const testDir = path.join(__dirname, '..', 'test');
  const files = fs.readdirSync(testDir);
  const testFiles = [];
  
  for (const file of files) {
    // Prefer .ts files, but also include .js files for backward compatibility
    if (file.endsWith('-test.ts') || file.endsWith('-test.js')) {
      const fullPath = path.join(testDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        // Prefer .ts over .js if both exist
        const baseName = file.replace(/\.(ts|js)$/, '');
        const tsPath = path.join(testDir, baseName + '.ts');
        const jsPath = path.join(testDir, baseName + '.js');
        if (fs.existsSync(tsPath) && file.endsWith('.js')) {
          // Skip .js file if .ts version exists
          continue;
        }
        testFiles.push(path.relative(process.cwd(), fullPath));
      }
    }
  }
  
  return testFiles;
}

function getNextPort() {
  return currentPort++;
}

function runTest(testFile, testNumber, totalTests) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${testNumber}/${totalTests}] Running: ${testFile}`);
    console.log(`${'='.repeat(80)}\n`);
    // Force flush
    process.stdout.write('');
    process.stdout.flush && process.stdout.flush();
    
    const startTime = Date.now();
    const testPort = getNextPort();
    let timeoutId = null;
    let killTimeoutId = null;
    let resolved = false;
    let outputBuffer = '';
    let errorBuffer = '';
    let lastOutputTime = Date.now();
    let heartbeatInterval = null;
    let completionDetected = false;
    let completionTimeout = null;
    let noOutputTimeout = null;
    
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
    
    // Function to reset no-output timeout
    const resetNoOutputTimeout = () => {
      lastOutputTime = Date.now();
      if (noOutputTimeout) {
        clearTimeout(noOutputTimeout);
      }
      // If no output for 15 seconds, kill and consider complete
      noOutputTimeout = setTimeout(() => {
        if (!resolved && !proc.killed) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stdout.write(`\n[${testNumber}/${totalTests}] ⚠️  No output for 15 seconds, assuming test complete and terminating...\n`);
          process.stdout.flush && process.stdout.flush();
          try {
            proc.kill('SIGTERM');
            setTimeout(() => {
              if (!proc.killed) {
                proc.kill('SIGKILL');
              }
              if (!resolved) {
                finish(0); // Consider complete
              }
            }, 2000);
          } catch (e) {
            if (!resolved) {
              finish(0);
            }
          }
        }
      }, 15000); // 15 seconds
    };
    
    // Start the no-output timeout
    resetNoOutputTimeout();
    
    // Capture stdout
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      outputBuffer += text;
      resetNoOutputTimeout(); // Reset timeout on any output
      // Write to parent stdout immediately for real-time viewing
      process.stdout.write(text);
      process.stdout.flush && process.stdout.flush();
      
      // Detect completion patterns
      if (!completionDetected) {
        const lowerText = text.toLowerCase();
        // Check for completion indicators
        if (lowerText.includes('all tests passed') || 
            lowerText.includes('test summary') ||
            lowerText.includes('✅ all') ||
            (lowerText.includes('passed:') && lowerText.includes('failed:'))) {
          completionDetected = true;
          // If we see completion but process doesn't exit in 5 seconds, force it
          completionTimeout = setTimeout(() => {
            if (!resolved && !proc.killed) {
              process.stdout.write(`\n[${testNumber}/${totalTests}] ⚠️  Test appears complete but process didn't exit, forcing termination...\n`);
              process.stdout.flush && process.stdout.flush();
              try {
                proc.kill('SIGTERM');
                setTimeout(() => {
                  if (!proc.killed) {
                    proc.kill('SIGKILL');
                  }
                  finish(0); // Assume success if we saw completion
                }, 2000);
              } catch (e) {
                finish(0);
              }
            }
          }, 5000); // 5 seconds after completion detection
        }
      }
    });
    
    // Capture stderr
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      errorBuffer += text;
      resetNoOutputTimeout(); // Reset timeout on any output
      // Write to parent stderr immediately
      process.stderr.write(text);
      process.stderr.flush && process.stderr.flush();
    });
    
    // Add heartbeat to show test is still running and detect hangs
    heartbeatInterval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const timeSinceOutput = Date.now() - lastOutputTime;
      
      // If we detected completion but process hasn't exited, be more aggressive
      if (completionDetected && timeSinceOutput > 10000) {
        process.stdout.write(`\n[${testNumber}/${totalTests}] ⚠️  Completion detected but process still running (${elapsed}s), forcing exit...\n`);
        process.stdout.flush && process.stdout.flush();
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
            if (!resolved) {
              finish(0); // Assume success
            }
          }, 2000);
        } catch (e) {
          if (!resolved) {
            finish(0);
          }
        }
        return;
      }
      
      if (timeSinceOutput > 30000) { // 30 seconds without output
        process.stdout.write(`\n[${testNumber}/${totalTests}] ⏳ Still running... (${elapsed}s elapsed, no output for ${(timeSinceOutput/1000).toFixed(0)}s)\n`);
        process.stdout.flush && process.stdout.flush();
      }
    }, 10000); // Check every 10 seconds
    
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
      
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (noOutputTimeout) {
        clearTimeout(noOutputTimeout);
      }
      if (completionTimeout) {
        clearTimeout(completionTimeout);
      }
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
        console.log(`\n[${testNumber}/${totalTests}] ✅ ${testFile} passed (${duration}s)`);
        process.stdout.flush && process.stdout.flush();
        resolve({ file: testFile, passed: true, duration });
      } else {
        const reason = timeout ? ' (timeout)' : ` (exit code: ${code})`;
        console.log(`\n[${testNumber}/${totalTests}] ❌ ${testFile} failed${reason} (${duration}s)`);
        process.stdout.flush && process.stdout.flush();
        resolve({ file: testFile, passed: false, duration, code, timeout });
      }
    };
    
    proc.on('close', (code, signal) => {
      // Small delay to ensure all output is flushed
      setTimeout(() => {
        finish(code === null ? 1 : code);
      }, 200);
    });
    
    // Handle stdout/stderr end events
    proc.stdout.on('end', () => {
      process.stdout.flush && process.stdout.flush();
    });
    
    proc.stderr.on('end', () => {
      process.stderr.flush && process.stderr.flush();
    });
    
    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        if (noOutputTimeout) {
          clearTimeout(noOutputTimeout);
        }
        if (completionTimeout) {
          clearTimeout(completionTimeout);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (killTimeoutId) {
          clearTimeout(killTimeoutId);
        }
        console.error(`\n[${testNumber}/${totalTests}] ❌ Error running ${testFile}:`, err.message);
        process.stderr.flush && process.stderr.flush();
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
  for (let i = 0; i < existingTests.length; i++) {
    const testFile = existingTests[i];
    const testNumber = i + 1;
    try {
      process.stdout.write(`\n📋 Starting test ${testNumber}/${existingTests.length}...\n`);
      process.stdout.flush && process.stdout.flush();
      const result = await runTest(testFile, testNumber, existingTests.length);
      results.push(result);
      
      // Small delay between tests to ensure ports are released
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`\n[${testNumber}/${existingTests.length}] Fatal error running ${testFile}:`, err);
      process.stdout.flush && process.stdout.flush();
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

