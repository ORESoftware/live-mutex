/**
 * Created by denman on 1/12/16.
 */


const constants = require('./suman-constants');
const fatalRequestReply = require('../lib/helpers/fatal-request-reply');

function SumanError() {

}

SumanError.prototype = Object.create(Error.prototype);
SumanError.prototype.constructor = SumanError;


function control(isThrow, err) {
    if (isThrow) {
        throw err;
    }
    else {
        return err;
    }
}

function filter(suman, isFatal, err) {

    // var stack = String(err.stack).split('\n');

    const stack = err.stack || err;

    var firstMatch = false;

    // stack = stack.map(function (item, index) {
    //     if (index === 0) {
    //         return item;
    //     }
    //     //TODO: need to make this work with Windows also
    //     if (item) {
    //         //if (String(item).match(/at TestSuite/) && !String(item).match(/suman\/lib/)) {
    //         //    return item;
    //         //}
    //         if (!firstMatch && String(item).match(suman.fileName) /*|| !String(item).match(/suman\/lib/)*/) {
    //             firstMatch = true;
    //             return item;
    //         }
    //     }
    // }).filter(function (item) {
    //     return item;
    // }).join('\n').concat('\n');

    var type = isFatal ? 'FATAL' : 'NON_FATAL_ERR';

    return fatalRequestReply({
        type: type,
        data: {
            msg: stack
        }
    }, function () {

        if (isFatal) {
            process.exit(constants.EXIT_CODES.BAD_CONFIG_OR_PROGRAM_ARGUMENTS);
        } else {
            process.stdout.write('\n' + stack + '\n');
        }

    });

}


module.exports = {

    noHost: function (isThrow) {
        return control(isThrow, new Error('no host defined'));
    },

    noPort: function (isThrow) {
        return control(isThrow, new Error('no port defined'));
    },

    badArgs: function (suman, isFatal, err) {
        return filter(suman, isFatal, err);
    }


};
