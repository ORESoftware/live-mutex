


const suman = require('suman');
const Test = suman.init(module, {
    pre: ['smartconnect'],
    post: ['judas']
});


Test.describe(__filename, {}, function (assert) {

    this.before(t => {
        console.log('before a');
    });

});

process.nextTick(function(){
    throw new Error('After Test.describe()');
});
