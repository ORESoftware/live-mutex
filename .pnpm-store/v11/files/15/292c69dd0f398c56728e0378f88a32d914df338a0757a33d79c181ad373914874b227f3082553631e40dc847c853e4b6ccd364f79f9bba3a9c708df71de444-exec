#!/usr/bin/env node

process.stdin.on('readable', () => {
  let chunk = process.stdin.read();
  if (String(chunk).match('suman')) {
    process.stdout.write(chunk);
  }
});

process.stdin.on('end', () => {
  process.stdout.write('end');
});
