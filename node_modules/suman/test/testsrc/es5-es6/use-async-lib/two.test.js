const suman = require('suman');
const Test = suman.init(module, {});
const Promise = require('bluebird');

Test.describe.delay('demonstrates usage of promises with delay/resume feature', {}, function (assert, resume) {

    console.log('assert => ', assert);

    this.before(t => {
        console.log('before');
    });


   Promise.map([1,3,4], function(val){
       return Promise.resolve(val*3);
   }).then(resume);


    this.describe('uses async library', function () {

        const vals = this.getResumeValue();
        console.log(' => vals => ', vals);

        console.log(' => ');

        this.it('fn', function () {


        });

    });

    this.describe('uses async library', function () {

        const vals = this.getResumeValue();
        console.log(' => vals => ', vals);

        console.log(' => ');

        this.it('fn', function () {


        });

    });


});
