

const m = new Map();

const z = m.set('3',true);

for(let [k,v] of m){
  console.log(k,v);
}

m.forEach((v, k)  => {
  console.log(k,v);
});





