/**
 * Created by Olegzandr on 10/1/16.
 */


const sumanUtils = require('../utils');


const arr = sumanUtils.getArrayOfDirsToBuild(
  '/Users/Olegzandr/WebstormProjects/oresoftware/suman/test-target',
  '/Users/Olegzandr/WebstormProjects/oresoftware/suman/test/integration-tests/test0.js'
);

console.log(arr);