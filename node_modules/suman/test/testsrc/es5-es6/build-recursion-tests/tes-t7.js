/**
 * Created by denman on 1/2/2016.
 */



const Test = require('suman').init(module, {
    export: false,
    integrants: ['smartconnect', 'dolce-vida'],
    iocData: {  //we pass this data to ioc file
        choodles: function () {

        }
    }
});


Test.describe('Suite7', {parallel: true}, function (fs, choodles, request, assert) {


    this.before.cb(t => {
        t.ctn();
    });


    this.it('blue1', function*(t) {
        yield 3;
        yield 4;
        yield 5;
    });

    this.it('blue2', function*(t) {
        yield 3;
        yield 4;
        yield 5;
        yield 3;
        yield 4;
        yield 5;
        yield 3;
        yield 4;
        yield 5;
        yield 3;
        yield 4;
        yield 5;
    });


    this.it('yes', {}, function * ageage(t) {

        const five = yield 5;
        const res = yield new Promise(function (resolve) {
            resolve(five);
        });


        const val = yield new Promise(function (resolve, reject) {

            setTimeout(function () {
                resolve();
            }, 100);


        }).then(function () {

            return new Promise(function (resolve, reject) {

                setTimeout(t.wrap(function () {
                    resolve(5);
                }), 100);

            });

        });
        assert.equal(val, 5);

    });


    this.it.cb('[test] yo 1', {parallel: true}, t => {

        fs.createReadStream('/dev/null').pipe(fs.createWriteStream('/dev/null')).on('error', t.fail).on('finish', t.pass);

    });


    this.it('has one', function () {

    });

    this.describe('loop', function () {

        [1, 2, 3, 4, 5, 6].forEach(val=> {

            this.it.cb('tests ' + val, {parallel: !!val}, function (t) {

                // assert(false);
                //this.should.have.property('name', 'tj');

                t.pass();

            });
        });


    });


    this.describe.skip('1', {efa: true}, function () {

        this.before.cb(t => {

            setTimeout(function () {
                t.done();
            }, 10);

        });


        this.it('[test] yo 2', {parallel: false}, t => {

            return new Promise(function (resolve, reject) {

                setTimeout(function () {
                    resolve();
                }, 100);


            }).then(function () {

                return new Promise(function (resolve, reject) {

                    setTimeout(t.wrap(function () {
                        resolve();
                    }), 100);

                });

            });

        });

        //this.it('[test] yo 2', {parallel: false}, new Promise(function (resolve, reject) {
        //
        //    Promise.delay(1000).then(function () {
        //        resolve();
        //    });
        //
        //}).then(function(){
        //
        //
        //
        //}));


        function p(val) {
            return new Promise(function (resolve) {
                resolve('doooog' + val);
            });
        }

        this.it('[test] gen', {parallel: false}, function *(t) {

            var val = yield p();
            val = yield p(val);

        });


        this.it.cb('yo', {parallel: false}, t => {

            // throw new Error('PAsta');
            setTimeout(function () {

                t.done();
            }, 100);

        });

        this.it.cb('chubs', {parallel: false, plan: 2}, t => {
            t.confirm();
            setTimeout(function () {
                t.confirm();
                t.done();
            }, 100);

        });

    });

});

