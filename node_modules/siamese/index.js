

function Siamese() {
}

Siamese.prototype.parse = function (obj) {

    return Promise.resolve(obj).then(function (obj) {
        if (typeof obj !== 'string') {
            //warning: looks like you have called ijson.parse on an object that was already parsed
            return Promise.resolve(obj);
        }
        else {
            var ret = JSON.parse(obj);
            if (typeof ret === 'object' && ('#stringified' in ret)) {
                if(Object.keys(ret).length > 1){
                    console.error('Warning: object had more than 1 key, including #stringified key.');
                }
                ret = ret['#stringified'];
            }
            return Promise.resolve(ret);
        }
    }).catch(function (err) {
        return Promise.reject(err);
    });
};

Siamese.prototype.stringify = function (obj) {

    return Promise.resolve(obj).then(function (obj) {

        if (typeof obj === 'string') {
            if (obj.indexOf('{"#stringified"') === 0) {
                return Promise.resolve(obj);
            }
        }

        if (typeof obj === 'object' && Object.keys(obj).length === 1 && ('#stringified' in obj)) {
            console.error('warning: object you wish to stringify with IJSON already has a top-level "#stringified" property.');
        }

        return Promise.resolve(JSON.stringify({'#stringified': obj}));

    }).catch(function (err) {
        return Promise.reject(err);
    });

};



module.exports = new Siamese();
