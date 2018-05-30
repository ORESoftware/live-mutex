import suman = require('suman');
const Test = suman.init(module);

Test.create(['Client', 'Broker', 'lmUtils', function (b, assert, before, describe, it, inject, $core, $deps) {
  
  const {Client, Broker, lmUtils} = b.ioc;
  const {child_process: cp, fs, path} = $core;
  const {async} = $deps;
  const multi_process_port = 3018;
  // you must MANUALLY launch the broker on port 3018
  
  process.setMaxListeners(1000);
  process.stderr.setMaxListeners(1000);
  process.stdout.setMaxListeners(1000);
  
  const p = path.resolve(__dirname + '/../../fixtures/run-in-child-process.js');
  
  it.cb('do things', {timeout: 50000}, t => {
    
    async.times(5, function (n, cb) {
      
      const k = cp.spawn('node', [p], {
        env: Object.assign({}, process.env, {
          multi_process_port
        })
      });
      
      k.stderr.setEncoding('utf8');
      k.stderr.pipe(process.stderr);
      
      k.once('exit', function (code) {
        cb(code, {code});
      });
      
    }, function (err, result) {
      
      if (result) {
        console.log('the result:', result);
      }
      
      t.done(err);
      
    });
    
  });
  
}]);









