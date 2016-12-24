/**
 * Created by denman on 3/17/2016.
 */


module.exports = () => {


    return {

        //TODO: need to add a property to these values on

        A: {
            testPath: 'test/integration-tests/test0.js',
            obstructs: [/*'B','C'*/]
        },
        B: {
            testPath: 'test/integration-tests/test1.js',
            obstructs: [/*'C'*/]
        },
        C: {
            testPath: 'test/integration-tests/test2.js',
            obstructs: [/*'A'*/]
        },
        //D: {
        //    testPath: 'test/integration-tests/test3.js',
        //    obstructs: ['E','C']
        //},
        //E: {
        //    testPath: 'test/integration-tests/test4.js',
        //    obstructs: ['F','A']
        //},
        //F: {
        //    testPath: 'test/integration-tests/test5.js',
        //    obstructs: ['B','C']
        //},
        Z: {
            testPath: 'test/build-tests/test7.js',
            obstructs: [/*'B','G'*/]
        },
        G: {
            testPath: 'test/build-tests/test8.js',
            obstructs: [/*'A','B','H','C','Z'*/]
        },
        H: {
            testPath: 'test/build-tests/test9.js',
            obstructs: [/*'G'*/]
        }

    }

};