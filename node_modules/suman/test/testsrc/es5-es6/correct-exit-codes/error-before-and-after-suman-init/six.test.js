


const suman = require('suman');
const Test = suman.init(module, {
    pre: ['smartconnect'],
    post: ['judas']
});


Test.describe(__filename, {}, function (assert) {

    this.before(t => {
        console.log('before a');
    });

    this.it('a', t=> {

    });

    this.it('a', t=> {

    });

    this.it('a', t=> {

    });

    process.nextTick(function(){
        // throw new Error('Asynchronously thrown from inside root suite.');
    });
});


