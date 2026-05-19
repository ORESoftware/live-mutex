
# Prepend-Transform

## Installation

```bash
npm install -S prepend-transform
```


## Usage

```javascript

import pt from 'prepend-transform';
import * as cp from 'child_process';

const n = cp.spawn('bash');

n.stdout.pipe(pt('child stdout: ')).pipe(process.stdout);
n.stderr.pipe(pt('child stderr: ')).pipe(process.stderr);

```
