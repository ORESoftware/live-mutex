#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {PassThrough} = require('stream');
const {createParser, defaultJSONParseDelayEvery} = require('../dist/json-parser');

function immediate() {
  return new Promise(resolve => setImmediate(resolve));
}

function collectStream(readable) {
  return new Promise((resolve, reject) => {
    const out = [];
    readable.on('data', v => out.push(v));
    readable.on('error', reject);
    readable.on('end', () => resolve(out));
  });
}

async function testDefaultDelay() {
  const parser = createParser();
  assert.strictEqual(parser.delayEvery, defaultJSONParseDelayEvery);
  assert.strictEqual(parser.delay, true);
}

async function testEnvOverride() {
  const previous = process.env.LMX_JSON_PARSE_DELAY_EVERY;
  process.env.LMX_JSON_PARSE_DELAY_EVERY = '7';

  try {
    const parser = createParser();
    assert.strictEqual(parser.delayEvery, 7);
  }
  finally {
    if (previous === undefined) {
      delete process.env.LMX_JSON_PARSE_DELAY_EVERY;
    }
    else {
      process.env.LMX_JSON_PARSE_DELAY_EVERY = previous;
    }
  }
}

async function testSplitUtf8() {
  const parser = createParser();
  const input = new PassThrough();
  const outP = collectStream(input.pipe(parser));
  const face = '\u{1F60A}';
  const payload = Buffer.from(JSON.stringify({msg: `hello ${face}`}) + '\n', 'utf8');
  const faceBytes = Buffer.from(face, 'utf8');
  const split = payload.indexOf(faceBytes) + 1;

  assert.ok(split > 0);

  input.write(payload.subarray(0, split));
  input.end(payload.subarray(split));

  const out = await outP;
  assert.deepStrictEqual(out, [{msg: `hello ${face}`}]);
}

async function testLargeChunkYield() {
  const parser = createParser({delayEvery: 2});
  const values = [];
  const payload = Buffer.from(
    Array.from({length: 6}, (_, i) => JSON.stringify({i})).join('\n') + '\n',
    'utf8'
  );

  parser.on('data', v => values.push(v));

  let transformDone = false;
  const transformP = new Promise((resolve, reject) => {
    parser._transform(payload, 'buffer', err => {
      if (err) {
        reject(err);
        return;
      }

      transformDone = true;
      resolve();
    });
  });

  assert.strictEqual(transformDone, false);

  await immediate();
  assert.strictEqual(transformDone, false);

  await transformP;

  assert.deepStrictEqual(
    values,
    Array.from({length: 6}, (_, i) => ({i}))
  );
}

(async () => {
  await testDefaultDelay();
  await testEnvOverride();
  await testSplitUtf8();
  await testLargeChunkYield();
  console.log('json-parser wrapper tests passed');
})().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
