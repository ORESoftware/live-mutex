'use striiiict';



//project
const makeGen = require('../helpers/async-gen');


module.exports = Object.freeze({


    handlePotentialPromise: function handlePotentialPromise(done, str) {

        return function handle(val, warn) {

            if ((!val || (typeof val.then !== 'function')) && warn) {
                global._writeTestError('\n => Suman warning: you may have forgotten to return a Promise => \n' + str + '\n');
            }

            Promise.resolve(val).then(function () {
                done(null);
            }, done);
        }
    },

    makeHandleGenerator: function makeHandleGenerator(done) {

        return function (fn, args, ctx) {
            const gen = makeGen(fn, ctx);
            gen.apply(ctx, args).then(function (val) {
                done(null, val);
            }, done);

        }
    }

});