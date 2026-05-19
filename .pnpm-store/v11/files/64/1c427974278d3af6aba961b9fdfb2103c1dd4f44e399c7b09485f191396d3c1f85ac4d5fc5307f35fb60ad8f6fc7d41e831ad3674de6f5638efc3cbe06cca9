## Description
Has the same effect as the command line command: `chmod -R`.

## Install

```
npm i --save chmodr
```

## Usage

Takes the same arguments as [`fs.chmod()`](https://nodejs.org/api/fs.html#fs_fs_chmod_path_mode_callback)

chmodr(path, mode, callback)
* path `<string>` | `<Buffer>` | `<URL>`
* mode `<integer>`
* callback `<Function>`
    * err `<Error>`

## Example
```javascript
var chmodr = require('chmodr');

chmodr('/var/www/my/test/folder', 0o777, (err) => {
  if (err) {
    console.log('Failed to execute chmod', err);
  } else {
    console.log('Success');
  }
});
```
