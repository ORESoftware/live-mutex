'use strict';

const cp = require('child_process');


const k = cp.spawn('bash', [], {
  stdio: ['ignore', 'inherit', 'inherit']
});

process.once('message', function (m) {

  k.stdin.write('\n' + m.msg.bashStdin + '\n');
  k.stdin.end();

  k.once('exit', function (code) {
    console.log('test process exited with code => ', code);
    process.exit(code);
  });

});
