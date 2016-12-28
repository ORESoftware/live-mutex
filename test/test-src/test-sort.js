

const vars = [1,2,3,4,5,1,1,1,1,1,2,3,4,5,1,2,11,3,3,3,3,3,4,4,4,1,1,1];

const _ = require('lodash');

function findAndRemoveFirstMatch(m, list){
    for(var i = 0; i < list.length; i++){
        if(m === list[i]){
            return list.splice(i,1)[0];
        }
    }
}

function getSorted(list){

    const ret = [];

    const set = _.uniqBy(list, function(x){
        return x;
    });

    while(list.length > 0){

        var i = 0;
        while(i < set.length && list.length > 0){
            var item;
            if(item  = findAndRemoveFirstMatch(set[i],list)){
                ret.push(item);
            }
            i++;
        }

    }

    return ret;

}

console.log(getSorted(vars));