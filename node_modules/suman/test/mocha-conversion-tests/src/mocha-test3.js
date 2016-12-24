/**
 * Created by denmanm1 on 4/6/16.
 */
/**
 * Created by denmanm1 on 3/20/16.
 */

var assert = require("assert"),
    fs = require('fs');


describe('a', function () {


    before(function () {
        console.log('before this a:', this.parent);
    });

    after(function () {

        console.log('after this a:', this.parent);

    });


    it('a');


});
