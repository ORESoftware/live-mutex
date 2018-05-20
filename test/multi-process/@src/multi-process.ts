import suman = require('suman');
const Test = suman.init(module);

Test.create(['Broker', 'Client', 'lmUtils', function (b, assert, before, describe, it, inject, $core, $deps) {
  
  const {Client, Broker, lmUtils} = b.ioc;
  const {child_process, fs, path} = $core;
  const {async} = $deps;
  
  const multi_process_port = 3018;
  
  // you should launch a broker MANUALLY
  
  // before(h => {
  //   return new Broker({port: multi_process_port}).ensure();
  // });
  
  it.cb('launches several processes', {timeout: 50000}, t => {
    
    const p = path.resolve(__dirname + '/../../fixtures/run-in-child-process.js');
    
    async.times(1, function (n, cb) {
      
      const k = child_process.spawn('node', [p], {
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
      
      if (result && result.stderr) {
        console.log(result.stderr);
      }
      
      t.done(err);
      
    });
    
  });
  
}]);
