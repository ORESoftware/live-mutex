'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareVersions = void 0;
var compareVersions = function (clientVersion, brokerVersion) {
    if (!(clientVersion && typeof clientVersion === 'string')) {
        throw new Error("The client version is not defined as string: '".concat(clientVersion, "'"));
    }
    if (!(brokerVersion && typeof brokerVersion === 'string')) {
        throw new Error("The broker version is not defined as string: '".concat(brokerVersion, "'"));
    }
    var _a = clientVersion.split('.'), majorA = _a[0], minorA = _a[1];
    var _b = brokerVersion.split('.'), majorB = _b[0], minorB = _b[1];
    if (majorA !== majorB) {
        throw "Major versions are different - client version:".concat(clientVersion, ", server version:").concat(brokerVersion);
    }
    var minorAInt = Number.parseInt(minorA.charAt(0));
    var minorBInt = Number.parseInt(minorB.charAt(0));
    if (Math.abs(minorAInt - minorBInt) > 0) {
        throw "Minor versions are different - client version:".concat(clientVersion, ", server version:").concat(brokerVersion);
    }
};
exports.compareVersions = compareVersions;
