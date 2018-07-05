
### Notes about Node.js core domain/domains

* Live-Mutex lock and unlock callbacks are always fired in future ticks of the event loop
* Each client lock or unlock callback is currently bound to the active domain, using

```js
if(process.domain){
  cb = process.domain.bind(cb)
}
```


* What this means is this:

```js
const Domain = require('domain');
const client = new Client()

app.use(function(req,res,next){

   const d = Domain.create();
   d.once('error', next);

   d.run(function(){

      client.ensure(function(err, c){

         c.lock('foo', function(err, unlock){
         
             throw 'whoops';  // this will get caught by the domain
             
             unlock(next);
         });
      });

   });

});
```

