/**
 * Created by oleg on 12/23/16.
 */



const client = require('../client');
const colors = require('colors/safe');


client.lock('a', {}).then(function(data){

    console.log(" ONE lock acquired!!! => \n", data);

    return client.unlock('a').then(function(data){
          console.log('\n',colors.green(' => unlock data success! => '),'\n', data,'\n');
          return data;
    });

}, function(err){

    console.error(err.stack || err);

});


client.lock('a', {}).then(function(data){

    console.log(" TWO lock acquired!!! => \n", data);

    return client.unlock('a').then(function(data){
        console.log('\n',colors.green(' => unlock data success! => '),'\n', data,'\n');
        return data;
    });

}, function(err){

    console.error(err.stack || err);

});


client.lock('a', {}).then(function(data){

    console.log(" THREE lock acquired!!! => \n", data);

    return client.unlock('a').then(function(data){
        console.log('\n',colors.green(' => unlock data success! => '),'\n', data,'\n');
        return data;
    });

}, function(err){

    console.error(err.stack || err);

});