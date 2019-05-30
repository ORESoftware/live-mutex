


const mapToArray = (iterable, fn) => {
  
  const results = [];
  
  let i =0;
  
  for(let v of iterable){
    results.push(fn.call(null, v, i++));
  }
  
  return results;
};


const m = new Map([[1,4],[8,4]]);


const results = mapToArray(m.entries(),(v,i) => {
  return i+1;
});


console.log(results);