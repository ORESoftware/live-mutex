/**
 * Created by denman on 5/3/2016.
 */

const suman = require('suman');
const Test = suman.init(module);

Test.describe('Catches exceptions', {}, function(fs){

    this.it('A', t => {
        return new Promise(function(resolve){
            fs.exists('foo', function(){
                throw new Error('123');
                resolve();  // won't get reached, but here for clarity
            });
        });
    });

    this.it('B', t => {
        return new Promise(function(resolve){
            setTimeout(function(){
                throw new Error('123');
                resolve(); // won't be reached, but here for clarity
            }, 100);
        });
    });

    this.it('C', t => {
        return new Promise(function(resolve){
            setImmediate(function(){
                throw new Error('456');
                resolve(); // won't be reached, but here for clarity
            });
        });
    });

    this.it('D', t => {
        return new Promise(function(resolve){
            process.nextTick(function(){
                throw new Error('789');
                resolve(); // won't be reached, but here for clarity
            });
        });
    });
});