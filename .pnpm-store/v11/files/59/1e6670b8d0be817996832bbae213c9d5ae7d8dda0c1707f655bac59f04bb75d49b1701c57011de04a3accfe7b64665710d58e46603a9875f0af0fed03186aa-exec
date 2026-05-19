'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
function isBasic(stream) {
    return stream !== null && typeof stream === 'object' && typeof stream.pipe === 'function';
}
function isWritable(stream) {
    return isBasic(stream) && stream.writable !== false && typeof stream._write === 'function' &&
        typeof stream._writableState === 'object';
}
function IsReadable(stream) {
    return isBasic(stream) && stream.readable !== false && typeof stream._read === 'function' &&
        typeof stream._readableState === 'object';
}
function isDuplex(stream) {
    return isWritable(stream) && IsReadable(stream);
}
function isTransform(stream) {
    return isDuplex(stream) && typeof stream._transform === 'function' &&
        typeof stream._transformState === 'object';
}
exports.isTransform = isTransform;
function isStream(stream) {
    return isBasic(stream) && (isWritable(stream) || IsReadable(stream));
}
exports.isStream = isStream;
function isObservable(val) {
    return (val && typeof val.subscribe === 'function'
        && val.constructor && (/Observable/.test(val.constructor.name) || /Subject/.test(val.constructor.name)));
}
exports.isObservable = isObservable;
function isSubscriber(val) {
    return (val && typeof val.subscribe !== 'function' && typeof val.usubscribe !== 'function'
        && typeof val._next === 'function' && typeof val._error === 'function' && typeof val._complete === 'function');
}
exports.isSubscriber = isSubscriber;
