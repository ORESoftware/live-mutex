
// *************************************************************************************************************************
// this file allows you to create constaints for the Suman test runner
// it allows you to prevent two particular processes from running at the same time, to prevent unwanted interaction
// ************************************************************************************************************************


//example:


/*


 module.exports = () => {

 return {

 A: {
 testPath: '',
 obstructs: [],
 estimatedTimeInSeconds: 500
 },
 B: {
 testPath: '',
 obstructs: [],
 estimatedTimeInSeconds: 500
 }

 }

 };


*/



module.exports = () => {

    return {

        A: {
            testPath: './test/test-src/parse-to-array/five.test.js',
            obstructs: ['B','C'],
            estimatedTimeInSeconds: 500
        },
        B: {
            testPath: './test/test-src/parse-to-array/four.test.js',
            obstructs: ['C'],
            estimatedTimeInSeconds: 500
        },
        C: {
            testPath: './test/test-src/parse-to-array/three.test.js',
            obstructs: ['D'],
            estimatedTimeInSeconds: 500
        },
        D: {
            testPath: './test/test-src/parse-to-array/two.test.js',
            obstructs: ['C','A','B'],
            estimatedTimeInSeconds: 500
        }
    }

};