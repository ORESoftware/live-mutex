Array.prototype.reduceZ = function (a, b, c) {
  
  let currentVal = null, i = -1;
  
  if(typeof  c === 'function'){
    currentVal = c(this, b);
  }
  else if(arguments.length > 1){
    currentVal = b;
  }
  else{
    i = 1;
    currentVal = this[0];
  }
  
  // if(this.length < 1){
  //   throw new Error('Array must have more elements to run a reduce operation.');
  // }

  while(i < this.length){
    currentVal = a(currentVal, this[i]);
    i++;
  }
  
  return currentVal;
  
};


const reduceList = (list) => {
  
  return list.filter(Boolean).reduceZ((a, b, c) => {
      return [a];
  }, null, v => {
     return v.shift();
  });
  
  
};

const reduce = (list) => {
  
  return list.filter(Boolean).reduce((a, b, c) => {
    return a;
  });
  
  
};


console.log(reduceList([1,2,3]));
// console.log(reduce([]));