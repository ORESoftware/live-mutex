const suman = require('suman');
const Test = suman.init(module);

Test.describe('SimpleTest', {parallel: true}, function (assert, fs, http, os) {


    //
    //synchronous
    this.beforeEach({plan: 5, throws: /Expected plan count was 5/}, t=> {

        // t.plan(1);
        t.confirm();
        t.confirm();
        t.confirm();
        t.confirm();

    });

    this.beforeEach({plan: 5, throws: /Expected plan count was/}, t=> {

        console.log('yolo');

    });

    this.beforeEach({plan: 7, throws: /Expected plan count was/}, t=> {

        console.log('cholo');

    });

    this.it('yes', t => {

    });


});




