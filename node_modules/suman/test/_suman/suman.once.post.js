/**
 * Created by denman on 3/16/2016.
 */



//*************************************************************************************************************************************
// this is for dependency injection, y'all
// the purpose is to inject dependencies / values that are acquired *asynchronously*
// synchronous deps should be loaded with the require function, as per usual, but deps and values (such as db values) can and should be loaded via this module
// tests will run in separate processes, but you can use code sharing (not memory sharing) to share setup between tests, which is actually pretty cool
// ****************************************************************************************************************************************

module.exports = () => {  //load async deps for any of your suman tests

    return {

        'charlie': function () {
            return 'charlie';
        },
        'smartconnect': function () {
            return Promise.resolve({
                formica: 'not metal'
            });

        },
        'dolce-vida': (cb) => {

            setTimeout(function () {
                cb(null, new Error('rub'));
            }, 10);

        },

        'judas': function () {

            return new Promise(function (resolve, reject) {
                setTimeout(resolve, 100);
            })

        },

        'ugly': function () {

            return new Promise(function (resolve, reject) {
                setTimeout(resolve, 100);
            })

        }

    }

};
