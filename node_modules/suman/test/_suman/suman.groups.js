'use strict';

//core
const path = require('path');
const util = require('util');
const assert = require('assert');

//npm
const sumanUtils = require('suman-utils/utils');
const _ = require('underscore');

//////////////////////////////////////////////////////////////////////

const scripts = path.resolve(__dirname + '/scripts');

//TODO: these functions should give users options to use kubernetes or docker

function getScript(s) {
    return path.resolve(scripts + '/' + s + '.sh');
}

function getBuildArgs(name) {
    return ' --build-arg s=' + 'scripts/' + name + '.sh' + ' --build-arg sname=' + name + '.sh '
}


function build() {
    return 'cd ' + __dirname + ' &&  docker build ' + getBuildArgs(this.name) + ' -t ' + this.name + ' .'
}

function run() {
    return 'docker run -it --tty=false --rm ' + this.name;
}

function getPathToScript() {
    return path.resolve(scripts + '/' + this.name + '.sh');
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

const defaults = Object.freeze({
    allowReuseImage: false,
    useContainer: false,
    build: build,
    getPathToScript: getPathToScript,
    run: run
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports = data => {

    data = data || {};
    assert(typeof data === 'object', ' => Please pass in object to suman.groups.js function.');

    const groups = [

        {
            name: 'a',
            // allowReuseImage: false,
            // useContainer: false,
            //the machine hopefully *already* has the build saved on the fs, so won't have to rebuild
            // build: build,
            // getPathToScript: getPathToScript,
            // run: run

        },

        {
            name: 'b',
            // allowReuseImage: false,
            // useContainer: false,
            //the machine hopefully *already* has the build saved on the fs, so won't have to rebuild
            // build: build,
            // getPathToScript: getPathToScript,
            // run: run

        },

        {
            name: 'c',
            // allowReuseImage: false,
            // useContainer: false,
            //the machine hopefully *already* has the build saved on the fs, so won't have to rebuild
            // build: build,
            // getPathToScript: getPathToScript,
            // run: run

        },

    ];

    return {

        //TODO: have to handle the case where the build has already been built - don't want to rebuild container

        // put in .suman/groups/scripts
        // if pathToScript is null/undefined, will read script with the same name as the group in the above dir


        groups: groups.map(function (item) {
            const def = _.defaults({},data, item);
            const val = Object.assign({}, defaults, def);
            console.log('\n val => \n',util.inspect(val));
            return val;
        })
    }

};

