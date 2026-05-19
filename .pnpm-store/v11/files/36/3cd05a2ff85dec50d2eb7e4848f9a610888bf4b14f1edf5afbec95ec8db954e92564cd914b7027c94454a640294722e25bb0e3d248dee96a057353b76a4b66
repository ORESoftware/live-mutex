(function () {
  'use strict';

  /*
   * Wrap the numbers 0 to 256 in their foreground or background terminal escape code
   */
  var fgcodes = Array.apply(null, new Array(256)).map(function (_, i) { return '\x1b[38;5;' + i + 'm'; });
  var bgcodes = Array.apply(null, new Array(256)).map(function (_, i) { return '\x1b[48;5;' + i + 'm'; });

  /*
   * Slice the foreground and background codes in their respective sections
   */
  var fg = module.exports.fg = {
    codes: fgcodes,
    standard: fgcodes.slice(0, 8),
    bright: fgcodes.slice(8, 16),
    rgb: fgcodes.slice(16, 232),
    grayscale: fgcodes.slice(232, 256),
    // get a red-green-blue value by index, in the ranged 0 to 6
    getRgb: function (r, g, b) { return fg.rgb[36*r + 6*g + b]; }
  };

  var bg = module.exports.bg = {
    codes: bgcodes,
    standard: bgcodes.slice(0, 8),
    bright: bgcodes.slice(8, 16),
    rgb: bgcodes.slice(16, 232),
    grayscale: bgcodes.slice(232, 256),
    // get a red-green-blue value by index, in the ranged 0 to 6
    getRgb: function (r, g, b) { return bg.rgb[36*r + 6*g + b]; }
  };

  var reset = module.exports.reset = '\x1b[0m';

}());
