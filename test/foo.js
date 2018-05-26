// const client = new Client(opts);
// // calling ensure means that we ensure we have a connected client
// client.ensure().then(c => {
//   // c === client => true
//   return client.acquire('<key>').then({key,id}) => {
//     // '<key>' === key => true
//     return client.release(key, id);
//   });
// });

const selectable = {a: null, b: null};
const v = {a: true, b: 'yes', c: 4};

const getSelectable = function (selectable, original) {
  return Object.keys(selectable).reduce((a, b) => (a[b] = original[b], a), {})
};

const r = getSelectable(selectable, v);
console.log(r);