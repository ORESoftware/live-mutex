

# Official Suman reporters

This repo contains reporters for both Node.js and the browser. Suman supports asynchronous reporters, so that reporters
can persist data using async I/O, etc, if they wish. 

<br>
If you are using a language other than JS with the Suman runner: <br>
what you do is write TAP or TAP-JSON to stdout in the language of your choice,
and the Suman runner will capture the stdout from your child process, and then use one of these reporters
to report the output in a more human friendly format in the parent process (the Suman runner is the parent process).


## Installing

```bash
$ npm install suman-reporters
```

## Loading reporters
Suman reporters in this package can be imported like so:

```typescript
// typescript
import r = require('suman-reporters/modules/tap-reporter');
```

```js
// js
const r = require('suman-reporters/modules/tap-reporter');
```



To use a reporter with the suman command line, the API is like so:

```bash
$ suman --reporter="tap-reporter"
```

You can load multiple reporters like so:

```bash
$ suman --reporter="tap-reporter" --reporter="std-reporter"
```


### The loading logic is as follows:

1. First suman will attempt to `require('tap-reporter')`
2. If the above fails, then it will attempt to `require('suman-reporters/modules/tap-reporter')`

So for "max efficiency", you could just use this:

```bash
$ suman --reporter="suman-reporters/modules/tap-reporter"
```

## Anatomy of a Suman-compliant reporter:

Export a function, either with `module.exports` or `exports.default`.

This function takes 4 arguments:

```js
exports.default = function(s, o, expct, c){
  
   // s is an event emitter instance
   // o is a copy of the suman command line options as a plain object
   // expct is a plain object representing the expected pass/fail/skipped/stubbed counts
   // c is a socket.io client

}

```

Take a look at the modules directory for up-to-date samples; TypeScript will aid in getting the types right.


