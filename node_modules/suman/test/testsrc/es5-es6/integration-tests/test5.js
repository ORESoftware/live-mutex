var suman = require('suman');
var Test = suman.init(module);


Test.describe.delay('A', {parallel: true}, function (request, socketio) {

    const arr = [1, 2, 3];

    setTimeout(() => {
        arr.push(4);
        arr.push(5);
        arr.push(6);
        this.resume();
    }, 100);

    this.before.cb(t => {
        setTimeout(t.done, 100);
    });

    this.describe.delay('B', function () {

        setTimeout(() => {
            arr.push(8);
            this.resume();
        }, 100);

        this.describe('ruffles', function () {
            arr.forEach((item)=> {
                this.it('[test]' + item, t => {
                    console.log('B => ' + t.desc);
                });
            });
        });
    });

    this.describe.delay('C', function () {

        setTimeout(() => {
            arr.push(9);
            this.resume();
        }, 100);

        this.describe.delay('j', function () {

            const suite = this;

            setTimeout(function () {
                arr.push(13);
                suite.resume();
            }, 100);

            arr.forEach((item)=> {
                this.it('[test]' + item, t => {
                    console.log('C => ' + t.desc);
                });
            });

            this.describe('D', function () {
                arr.forEach((item)=> {
                    this.it('[test]' + item, t => {
                        console.log('D => ' + t.desc);
                    });

                });

            });
        });

    });

});


