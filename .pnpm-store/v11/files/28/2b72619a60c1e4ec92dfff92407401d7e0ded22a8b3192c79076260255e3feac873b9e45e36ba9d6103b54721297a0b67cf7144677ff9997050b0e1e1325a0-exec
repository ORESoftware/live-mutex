
<br>

[![Version](https://img.shields.io/npm/v/residence.svg?colorB=green)](https://www.npmjs.com/package/residence)


# Residence

Allows you find a root of a project given current working directory (```process.cwd()```)


### Examples

> Looking for the NPM project root, by looking for package.json

```js
import * as residence from 'residence';
const rootPath = residence.findProjectRoot(process.cwd());
// root is either null or a project root path, found by looking for the first package.json file
```


> Looking for a project root, by looking for another file

```js
import * as residence from 'residence';
const rootPath = residence.findRootDir(process.cwd(), '.nlu.json');
// walks up the fs towards '/' and returns the path when it finds the first .nlu.json file
// returns null otherwise.
```
