

const util = require('util');


//////////////////////////////////////////////////////////////////////////////////////////////////

exports.conditionalReturn = function (fn, cb) {

    if (typeof cb === 'function') {
        fn(function (err, val) {
            if (err) {
                console.error(err.stack);
            }
            if(arguments.length > 2){
                console.error(' => Warning => Argument(s) lost in translation => ', util.inspect(arguments));
            }
            cb(err, val);
        });
    }
    else {
        return new Promise(function (resolve, reject) {
            fn(function () {

                if(arguments.length > 2){
                    console.error(' => Warning => Argument(s) lost in translation => ', util.inspect(arguments));
                }
                const args = Array.from(arguments);
                const err = args.shift();

                if (err) {
                    reject(err);
                }
                else {
                    //TODO: need to provide data about whether the server is live in this process or another process
                    resolve.apply(null, args);
                }
            });
        });
    }

};
