const _ = require('lodash');
const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const assert = require('assert');

const getValues = function () {
  
  const resultOuter = [];
  const alphabet2 = alphabet.slice(0, 4);
  
  const probabilities = [0.6, 0.2, 0.1, 0.1];
  
  for (let j = 0; j < 1000; j++) {
    
    const results = [];
    const remaining = new Set(alphabet2);
    
    for (let i = 0; i < alphabet2.length; i++) {
      
      const r = Math.random();
      const letter = alphabet2[i];
      
      if (r < probabilities[i] && remaining.has(letter)) {
        results.push(letter);
        remaining.delete(letter);
      } else {
        const rand = Math.floor(Math.random() * remaining.size);
        const lettr = Array.from(remaining).filter(v => v !== letter)[rand];
        remaining.delete(lettr);
        results.push(lettr);
      }
      
    }
    
    resultOuter.push(results);
  }
  return resultOuter;
};

const getValues2 = function () {
  
  const resultOuter = [];
  const alphabet2 = alphabet.slice(0, 4);
  
  const probabilities = [0.6, 0.2, 0.1, 0.1];
  
  for (let j = 0; j < 1000; j++) {
    
    const results = [];
    const remaining = new Set(alphabet2);
    
    for (let i = 0; i < alphabet2.length; i++) {
      
      const r = Math.random();
      const letter = alphabet2[i];
      
      if (r < probabilities[i]) {
        results[i] = letter;
        remaining.delete(letter);
      }
    }
    
    for (let i = 0; i < alphabet2.length; i++) {
      
      if (!results[i]) {
        const rand = Math.floor(Math.random() * remaining.size);
        const lettr = Array.from(remaining)[rand];
        remaining.delete(lettr);
        results[i] = lettr;
      }
      
    }
    
    resultOuter.push(results);
  }
  return resultOuter;
};

const results = getValues2();

let [a, b, c] = [0, 0, 0];

for (let v of results) {
  if (v[0] === 'a') {
    a++;
  }
  if (v[1] === 'b') {
    b++;
  }
  if (v[2] === 'c') {
    c++;
  }
}

console.log({a, b, c});
process.exit();

const findWinner2 = function (ballots, count) {
  
  const totals = {};
  console.log('count:', count);
  
  for (let i = 0; i < count; i++) {
    
    let total = 0;
    
    for (let v of ballots) {
      const val = v[i];
      if (val === undefined) {
        throw i + JSON.stringify(ballots);
      }
      if (!totals[val]) {
        totals[val] = 0;
      }
      totals[val] += 2 / ((i + 1) * 2);
      total += totals[val];
    }
    
    const results = [];
    
    for (let v of Object.keys(totals)) {
      
      if (totals[v] > Math.ceil(total / 2)) {
        results.push(v);
      }
      
    }
    
    
    if (results.length === 1) {
      return results[0];
    }
    
  }
  
  return totals;
  
};


const findWinner = function (ballots, totals) {
  
  
  for (let v of ballots) {
    
    const first = v[0];
    if (first) {
      if (!totals[first]) {
        totals[first] = 0;
      }
      totals[first]++;
    }
    
  }
  
  const eliminated = new Set();
  
  const recurse = () => {
    
    let highestCount = Number.MIN_SAFE_INTEGER;
    let lowestCount = Number.MAX_SAFE_INTEGER;
    let lowest = null;
    let val = null;
    let total = 0;
    
    for (let v of Object.keys(totals)) {
      total += totals[v];
      if (totals[v] > highestCount) {
        highestCount = totals[v];
        val = v;
      }
      if (totals[v] < lowestCount && !eliminated.has(v)) {
        lowestCount = totals[v];
        lowest = v;
      }
    }
    
    // if (highestCount > Math.ceil(total / 2)) {
    //   return val;
    // }
    
    console.log('totes:', {total});
    console.log('total:', Math.ceil(total / 2));
    
    if (highestCount > Math.ceil(total / 2)) {
      console.log('returning because 50%');
      return val;
    }
    
    console.log('lowest:', lowest);
    
    if (lowest) {
      eliminated.add(lowest);
    } else {
      return val;
    }
    
    console.log(
      'eliminated:', eliminated
    );
    
    // console.log({val});
    // if (highestCount > 3) {
    //   return val;
    // }
    
    console.log({ballots});
    
    
    for (let v of ballots) {
      
      while (true) {
        if (eliminated.has(v[0])) {
          v.shift();
        } else {
          break;
        }
      }
      
      const first = v[0];
      if (first) {
        if (!totals[first]) {
          totals[first] = 0;
        }
        totals[first]++;
      }
      
    }
    
    console.log({totals});
    
    return recurse();
  };
  
  return recurse();
  
};

for (let i = 0; i < 1; i++) {  //10000
  
  // const voteCount = 3 + Math.floor(Math.random() * 100);
  const voteCount = 20;
  const ballots = [];
  const candidateCount = 3 + Math.floor(Math.random() * 7);
  
  for (let j = 0; j < voteCount; j++) {
    ballots.push(_.shuffle(alphabet.slice(0, candidateCount)));
  }
  
  const winner = findWinner2(ballots, candidateCount);
  // const winner = findWinner(ballots, {});
  console.log({winner});
  assert.strict(winner, 'no winner');
}