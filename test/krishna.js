const versionA = '14.8.3';
const versionB = '15.1.1';
const versionC = '15.1.2';

const semver = require('semver');
const assert = require('assert');

// assert(semver.gt(versionA,versionB), 'b should be greater than a.');
// assert(semver.lt(versionA,versionB), 'b should be greater than a.');


const isGreater = (a, b) => {
  
  const [majorA, minorA, patchA] = String(a).split('.').map(v => Number.parseInt(v));
  const [majorB, minorB, patchB] = String(b).split('.').map(v => Number.parseInt(v));
  
  if (majorA !== majorB) {
    return majorA > majorB;
  }
  
  if (minorA !== minorB) {
    return minorA > minorB;
  }
  
  return patchA > patchB;
  
};


assert(isGreater(versionB, versionA), 'version b should be greater.');
// assert(isGreater(versionA, versionB), 'version b should be greater.');

