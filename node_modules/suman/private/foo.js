

function* powGenerator(){
    var result = Math.pow(yield 'a', yield 'b');
    return result;
}

var g = powGenerator();

console.log((g.next().value));
console.log((g.next(10).value));
console.log((g.next(2).value));
console.log((g.next(3).done));
console.log((g.next(3).done));
console.log(g.done);
