/**
 * Created by denman on 5/23/2016.
 */


"use strict";

module.exports = function freezeExistingProps(obj) {

    Object.keys(obj).forEach(function (key) {

        Object.defineProperty(obj, key, {
            writable: false
        });

    });

    return obj;

};