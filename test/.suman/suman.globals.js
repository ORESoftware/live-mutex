/**
 *
 * note to developers: if you wish to run any Suman test using the plain old node executable
 * then you need to require this suman.globals.js file using the --require option of the node executable, as in:
 *
 *  $ node --require ./<your-path-to>/suman.globals.js  your-test-file.js
 *
 *  like so: https://nodejs.org/dist/latest-v6.x/docs/api/cli.html
 *
 *  <achtung>
 *      !!
 *      please avoid using suman.globals.js if you can, there should be no no need for globals,
 *      use suman.ioc.js instead
 *      !!
 *  </achtung>
 *
 */
