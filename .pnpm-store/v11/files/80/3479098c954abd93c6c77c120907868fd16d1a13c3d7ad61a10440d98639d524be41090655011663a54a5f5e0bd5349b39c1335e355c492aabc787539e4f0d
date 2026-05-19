# find-exec

[![Downloads](https://img.shields.io/npm/dt/find-exec.svg)](https://npmjs.org/package/find-exec)

Takes a list of shell commands and returns the first available. Works synchronously to respect the order.

Returns `null` if none of the listed commands were found.

## Examples

    $ which mplayer
    which: no mplayer

    $ which afplay
    /usr/bin/afplay

```javascript
var command = require('find-exec')(["mplayer", "afplay", "cvlc"])
console.log(command) // afplay
```

```javascript
var command = require('find-exec')(["mplayer"])
console.log(command) // null
```

## Installation

    npm install find-exec

## License

MIT
