/**
 * Created by Olegzandr on 12/1/16.
 */


const suman = require('suman');

const one = suman.load({
    path: require.resolve('./one.test'),
    indirect: true
});

const colors = require('colors/safe');

var count = 0;
one.on('test',function(t){
  // count++;
  t.apply(null, ['a','b','c']);
});
