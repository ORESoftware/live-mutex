/**
 * Created by denman on 5/10/2016.
 */


const test = require('ava');
const fs = require('fs');


function asyncFn(cb) {
    process.nextTick(function(){
        cb(null, null);
    });
}


test.cb(t => {
    asyncFn((err, res) => {
        t.is(res.bar, 'ok');
        t.end();
    });
});