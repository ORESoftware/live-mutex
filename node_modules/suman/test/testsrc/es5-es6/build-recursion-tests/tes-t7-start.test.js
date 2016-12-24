/**
 * Created by denmanm1 on 4/9/16.
 */


var sumanEvents = require('./tes-t7.js');

sumanEvents.on('test', function (test) {

    test({a:'b',c:'d'});

});

