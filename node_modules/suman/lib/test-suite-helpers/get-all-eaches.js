/**
 * Created by denman on 1/5/2016.
 */

//#npm
const _ = require('underscore');


function makeGetAllEaches(suman, allDescribeBlocks) {

    function getAllBeforesEaches(test) {

        const beforeEaches = [];
        beforeEaches.unshift(test.getBeforeEaches());

        function getParentBefores(testId) {

            var parent = null;

            for (var i = 0; i < allDescribeBlocks.length; i++) {
                var temp = allDescribeBlocks[i];
                if (temp.testId === testId) {
                    parent = temp;
                    break;
                }
            }

            if (parent) {
                beforeEaches.unshift(parent.getBeforeEaches());
                if (parent.parent) {
                    getParentBefores(parent.parent.testId);
                }
            }
            else {
                throw new Error('this should not happen...');
            }

        }

        if (test.parent) {
            getParentBefores(test.parent.testId);
        }

        return _.flatten(beforeEaches, true);
    }

    function getAllAfterEaches(test) {

        const afterEaches = [];
        afterEaches.push(test.getAfterEaches());

        function getParentAfters(testId) {

            var parent = null;

            for (var i = 0; i < allDescribeBlocks.length; i++) {
                var temp = allDescribeBlocks[i];
                if (temp.testId === testId) {
                    parent = temp;
                    break;
                }
            }

            if (parent) {
                afterEaches.push(parent.getAfterEaches());
                if (parent.parent) {
                    getParentAfters(parent.parent.testId);
                }
            }
            else {
                throw new Error('this should not happen...');
            }

        }

        if (test.parent) {
            getParentAfters(test.parent.testId);
        }

        return _.flatten(afterEaches, true);
    }

    return {
        getAllAfterEaches: getAllAfterEaches,
        getAllBeforesEaches: getAllBeforesEaches
    }
}


module.exports = makeGetAllEaches;
