
### :: Installation ::

1. Run <span style="background-color:#ffdb99">&nbsp;```$ npm install -g suman```</span>

2. => cd into the project where you want to use Suman to power your tests

3. Run <span style="background-color:#ffdb99">&nbsp;```$ suman --init```</span>

** <i> note: advanced users who wish to avoid global installations, 
or those who use NVM, please see <a href="http://oresoftware.github.io/suman/11-advanced-installation.html">here</a>.</i>**

You have installed Suman, and now you will see that you have some new files in your project. 
You have a <span style="background-color:#DCDCDC">```suman.conf.js```</span> file at the root of your project. This file must remain at the root of your project.
You also have a directory called suman at the root of your project which contains several files and folders, <span style="background-color:#DCDCDC">```suman.once.js```</span>, <span style="background-color:#DCDCDC">```suman.order.js```</span>,
<span style="background-color:#DCDCDC">```suman.ioc.js```</span>. If you want to find out what these files are for, go to the Advanced Usage section from the home page, 
but for now, if you are brand new to suman you can ignore those and come back to them later. If you wish to move the suman directory away from the root directory of your project, we recommend putting
the suman folder in your test directory. Note that once you run ```$ suman --init``` for your project and commit the code to source control,
you won't have to run it again later on in your CI/CD pipeline, so there is no need to install suman globally on any machine but a dev box. In order to use Babel with Suman, please
see the using Babel section. Babel is not included with the standard install because it is too heavy.

## Alright, let's run a test

Individual test suite files can be run with either <span style="background-color:#9ACD32">&nbsp;```$ node path/to/your-test.js```</span> 
or <span style="background-color:#9ACD32">&nbsp;```$ suman path/to/your-test.js```</span>,
the result is the same, if you don't use any other command line options.

To use the Suman runner with a single test, you use <span style="background-color:#9ACD32">&nbsp;```$ suman --rnr path/to/your-test.js```</span>  If suman is run against a folder with multiple test files, like so: <span style="background-color:#9ACD32">&nbsp;```$ suman path/to/tests/folder```</span>
suman will use the runner, as Suman always uses the Suman runner with multiple files. As you may have figured out, 
if you point Suman at an individual test file, you the developer have the choice about whether to use the runner or not, using the <span style="background-color:#9ACD32">```--rnr```</span> flag.
The Suman runner is designed to manage and orchestrate the execution of all your tests in separate processes, and basically do central control.

    
>    Advantages of using the Suman runner for a single test
>
>    + The biggest advantage of using the runner with a *single test file* is that the runner can suppress your
>    console.log/debugging output, making it easier to see the actual results of the test.
>
>    Disadvantages of runner for a single test
>    
>    + 50-300ms slower to finish for a single test
>    + Harder to debug
    

Suman doesn't make any assumptions about your project structure. Most NPM projects have a test directory, which is very standard practice.
After installing Suman, you will have a directory called```"suman"``` at the root of your project. We highly recommend you move that directory into your
test directory (or whatever your have called your test directory), like so: 

In bash that would be:

``` $ mv suman test/_suman``` 

After doing that you will have to edit your ```suman.conf.js``` file, like so:
 
```    
{

 // sumanHelpersDir: 'suman',     change this line to the below line
 sumanHelpersDir: 'test/_suman'
  
}   

```

Here is a simple test file you can use to try Suman out, put the code in any .js file and run it with one of the above commands.

<br>
Save the file in some directory as simple-test.js and then run, ```$ node simple-test.js```
So simple, and it should feel great to be able to just run a test with node instead of some funky foreign command line app :)
<br>

```js

```

Finding files to run

You can either use command line tools like find, or you can use suman.conf.js and some command line options,
by default Suman will run all .js files in the "testSrcDir" defined by your config file.

e.g.

```$ suman```

if you specify arguments, like so:

```$ suman test/testsrc/shell```

Suman will run all the scripts in the shell directory and none more

the following config options:

```js
    matchAny: [/.js$/, /.sh$/],              //recommended =>  match: ['.test.js'],
    matchNone: [/fixture/, /correct-exit-codes/],
    matchAll: [],
```
    
as well as the following command line options:

```js
   --match-any           // will override any values in suman.conf.js
   --match-all           // will override any values in suman.conf.js
   --match-none          // will overrwide any values in suman.conf.js
   --append-match-any     // will append to any values in suman.conf.js
   --append-match-all     // will append to any values in suman.conf.js
   --append-match-none     // will append to any values in suman.conf.js
```

allow you to determine which files will be executed as tests

When using one of the above command line options, it is best to use single quotes like so:

``` $ suman --match-any 'test.js$'  --match-any 'test.sh' ```


here's some gist (add a github gist if necessary)

<script src="https://gist.github.com/ORESoftware/0c772aedd3630bb54f27.js"></script>
