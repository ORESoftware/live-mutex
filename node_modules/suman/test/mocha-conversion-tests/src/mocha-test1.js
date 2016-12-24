/**
 * Created by denmanm1 on 3/20/16.
 */

var assert = require("assert"),
    fs = require('fs');


describe('a',function(){

    var x = (this.parent);

    this.title.X;
    this.file.X;
    this.parent.title;  //this.parent is null

    describe('b',function(){

        (this.parent);
        this.title.X;             // ''
        this.file.X;              // ''
        this.parent.title;        // ''

        before(function(){

            //this.currentTest;   //  currentTest is not defined for before hooks
            //this.test.parent.title;  //  this.title;  (this.test.parent = this)

        });

        beforeEach(function(){

            (this.currentTest.parent.title);   // this.title
            (this.currentTest);    // this.currentTest = t
            (this.test.parent);    // this.test.parent = this
        });

        it('a', function(_$agea){

            (this.test.title);          // t.title
            (this.test.parent.title);   // this.title

            _$agea();
        });

        it('a', function(x){

            (this.test.title);               // t.title
            (this.test.parent.title);        // this.title

            x();

        });


        afterEach(function(){

            (this.currentTest.title) ;          // t.title
            (this.currentTest.parent.title);   // this.title
            (this.test.parent);                // this
        });


        after(function(){

            (this.title);

        });

    });

});
