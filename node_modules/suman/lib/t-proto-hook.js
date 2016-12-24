//core
const assert = require('assert');

//project
const proto = require('./t-proto');


function makeH(hook, assertCount) {

    var planCalled = false;

    function H(handleError) {
        this.__handle = handleError;
    }

    /*

    !!!

    // IMPORTANT NOTE: do not make any references to "this" in any prototype function because "this" may not be bound if the
    // the user passes the function directly, and does not call the function with "t" as in "t.x()" but instead
    // just calls "x()"

    */

    H.prototype = Object.create(proto);

    H.prototype.plan = function _plan(num) {
        if (!planCalled) {
            planCalled = true;
            if (hook.planCountExpected !== undefined) {
                global._writeTestError(new Error(' => Suman warning => t.plan() called, even though plan was already passed as an option.').stack);
            }
            assert(Number.isInteger(num), ' => Suman usage error => value passed to t.plan() is not an integer.');
            hook.planCountExpected = num;
        }
        else {
            global._writeTestError(new Error(' => Suman warning => t.plan() called twice.').stack);
        }
    };

    H.prototype.confirm = function _confirm() {
        assertCount.num++;
    };

    return H;

}

module.exports = makeH;