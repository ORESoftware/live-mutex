
[![Version](https://img.shields.io/npm/v/@oresoftware/safe-stringify.svg?colorB=green)](https://www.npmjs.com/package/@oresoftware/safe-stringify)

# @oresoftware/safe-stringify


####  Motivation/purpose for this library:

> [See this Github gist](https://gist.github.com/ORESoftware/10bd74e27728a2aa764df4d6c6ecada8) 


###  Installation:

>
>```bash
> $ npm i -S '@oresoftware/safe-stringify'
>```
>

##  For most objects (this is more performant)

```js
import * as safe from '@oresoftware/safe-stringify';
const s = safe.stringify({});
```

##  For use with more complex deeply-nested objects with arrays:


Note: stringifyDeep is *not* production ready, please don't use it yet, 
without improving it and making sure it works for you.


```js
import * as safe from '@oresoftware/safe-stringify';
const s = safe.stringifyDeep([{}]);
```

For example the following works with `stringifyDeep` but not `stringify`:

```js
const x = {dog:'bark'};
x.mmm = {'zebra': 3};
x.mmm = x;

const v = [x,x,x];
v.zzz = v;
v.foo = 5;
v.dog = 3;

const mmm = safe.stringifyDeep([v,v,v]);
console.log(mmm);

```


## > Using Map and Set, etc

This library does not treat Map and Set or other classes as special. To serialize a Map or Set instance, 
you might do:

```js

class HasMapAndSet {
  
  constructor(){
    this.map = new Map([['one',1], ['two',2]]);
    this.set = new Set([1,2,3]);
  }
   
  toJSON(){  // use this to transform Map and Set to {} or []
    return {
      map: Array.from(this.map),
      set: Array.from(this.set)
    }
  }
  
}


console.log(
  JSON.stringify(
    new HasMapAndSet()
  )
);

```
