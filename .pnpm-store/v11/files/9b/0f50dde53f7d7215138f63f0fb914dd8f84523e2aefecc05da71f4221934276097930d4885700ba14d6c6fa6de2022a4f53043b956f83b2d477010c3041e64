# ansi-256-colors [![Build Status](https://travis-ci.org/jbnicolai/ansi-256-colors.svg?branch=master)](https://travis-ci.org/jbnicolai/ansi-256-colors)

> [256 ansi color codes](https://en.wikipedia.org/wiki/ANSI_escape_code#Colors) for styling terminal output

You probably want the higher-level [chalk](https://github.com/sindresorhus/chalk) module for styling your strings.

![screenshot](https://i.imgur.com/Kilr0mC.png?1)


## Install

```sh
$ npm install --save ansi-256-colors
```

## Usage

```js
var colors = require('ansi-256-colors');

console.log(colors.fg.getRgb(2,3,4) + colors.bg.getRgb(4,4,4) + 'Hello world!' + colors.reset);
```

## API

The module exposes a `fg` and `bg` object, and a `reset` code. Both the foreground and background objects contain:

#### colors.\<fg|bg\>.getRgb(\<red\>[0..6], \<green\>[0..6], \<blue\>[0..6])

Returns the color code for the given red-green-blue value.

#### colors.\<fg|bg\>.codes[0..255]

All 256 color codes.

#### colors.\<fg|bg\>.standard[0..7]

The 8 base color codes, guaranteed to work on every system.

#### colors.\<fg|bg\>.bright[0..7]

The 8 base bright/bold color codes, guaranteed to work on every system.

#### colors.\<fg|bg\>.grayscale[0..23]

The 24 grayscales ranging from white to black.

#### colors.\<fg|bg\>.rgb[0..216]

The 216 varying color tints, where the order corresponds to the code-point 36\*`r` + 6\*`g` + `b`.

#### colors.reset

Closes any previously opened color codes.

## License

MIT © [Joshua Boy Nicolai Appelman](http://jbnicolai.com)
