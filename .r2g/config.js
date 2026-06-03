const path = require('path');

const workspaceRoot = path.resolve(
  process.env.R2G_SEARCH_ROOT ||
  process.env.MY_DOCKER_R2G_SEARCH_ROOT ||
  path.resolve(__dirname, '../..')
);

if (!path.isAbsolute(workspaceRoot)) {
  throw new Error('Please set R2G_SEARCH_ROOT or MY_DOCKER_R2G_SEARCH_ROOT to an absolute path.');
}

const projectRoot = path.resolve(__dirname, '..');

exports.default = {
  searchRoot: projectRoot,
  searchRoots: [
    path.resolve(workspaceRoot, 'json-stream-parser'),
    path.resolve(workspaceRoot, 'linked-queue'),
    path.resolve(workspaceRoot, 'suman')
  ],
  tests: '',
  packages: {
    '@oresoftware/json-stream-parser': true,
    '@oresoftware/linked-queue': true,
    'suman': true
  }
};
