#!/usr/bin/env node

/**
 * Simple helper to capture broker/client warning logs
 * Provides helper functions to attach warning listeners using the clean onWarning() method
 */

'use strict';

// Helper to attach warning listener using the clean onWarning() method
function attachWarningListener(instance, type) {
  if (instance && typeof instance.onWarning === 'function') {
    instance.onWarning(function(...args) {
      const prefix = `[LMX ${type}]`;
      const parts = args.map(arg => {
        if (arg instanceof Error) {
          return arg.message + (arg.stack ? '\n' + arg.stack : '');
        }
        return String(arg);
      });
      const message = parts.join(' ');
      process.stderr.write(`${prefix} ${message}\n`);
    });
  }
}

module.exports = {
  attachToBroker: (broker) => attachWarningListener(broker, 'BROKER'),
  attachToClient: (client) => attachWarningListener(client, 'CLIENT'),
  attachToRWClient: (client) => attachWarningListener(client, 'RW-CLIENT'),
};

