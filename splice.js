

const data = ['foo','\n','bar','\n','dog'].join('');

let lines = data.split('\n');

const v = lines.splice(lines.length - 1, 1);

console.log({v,lines});
