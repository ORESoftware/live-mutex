'use strict';

const EE = require('events');
const freezeExistingProps = require('./freeze-existing');

// const Writable = require('stream').Writable;

const $proto = Object.create(Function.prototype);
const proto = Object.create(Object.assign($proto, EE.prototype));


proto.wrap = function wrap(fn) {
    const self = this;
    return function () {
        try {
            fn.apply(this, arguments);
        } catch (e) {
            self.__handle(e, false);
        }
    }
};

proto.log = function log() {  //TODO: update this
    global._writeLog.apply(null, arguments);
};

proto.slow = function slow() {

};

// const proto = {
//
//     wrap: function wrap(fn) {
//         const self = this;
//         return function () {
//             try {
//                 fn.apply(this, arguments);
//             } catch (e) {
//                 self.__handle(e, false);
//             }
//         }
//     },
//
//     log: function log() {  //TODO: update this
//         global._writeLog.apply(null, arguments);
//     },
//
//     slow: function slow() {
//
//     }
//
// };


module.exports = freezeExistingProps(proto);


