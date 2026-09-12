'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  attachToBroker,
  clearCapturedLogs,
  disableLogCapture,
  enableLogCapture,
  getCapturedLogs,
} = require('./capture-logs');

test('capture helper subscribes to facade warning and error events', () => {
  let warningListener;
  let errorListener;
  const facade = {
    onWarning(listener) {
      warningListener = listener;
    },
    onError(listener) {
      errorListener = listener;
    },
  };

  enableLogCapture();
  try {
    attachToBroker(facade);

    assert.equal(typeof warningListener, 'function');
    assert.equal(typeof errorListener, 'function');

    warningListener('bounded warning');
    errorListener(new Error('captured failure'));

    const captured = getCapturedLogs();
    assert.equal(captured.length, 2);
    assert.deepEqual(
      captured.map(({type, source}) => ({type, source})),
      [
        {type: 'warning', source: 'broker'},
        {type: 'error', source: 'broker'},
      ],
    );
    assert.equal(captured[0].message, 'bounded warning');
    assert.match(captured[1].message, /^captured failure\nError: captured failure\n/);
  } finally {
    disableLogCapture();
    clearCapturedLogs();
  }
});
