'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.r2gSmokeTest = function () {
    return true;
};
exports.lp = function (str, strm, beforeHook, afterHook) {
    return function prependLog() {
        beforeHook && beforeHook();
        const args = Array.from(arguments);
        const hasNonWhitespace = args.some(function (a) {
            let str = String(a);
            return str.length > 0 && /\S/g.test(str);
        });
        if (hasNonWhitespace) {
            strm.write(str);
        }
        args.forEach(function (s, i) {
            String(s).split('\n').forEach(function (s, i) {
                if (i < 1) {
                    strm.write(s + ' ');
                }
                else {
                    if (/\S/g.test(s)) {
                        strm.write('\n' + str + s);
                    }
                    else {
                        strm.write('\n' + s);
                    }
                }
            });
        });
        strm.write('\n');
        afterHook && afterHook();
    };
};
exports.default = exports.lp;
