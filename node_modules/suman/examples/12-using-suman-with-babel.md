
# Using Suman with Babel

Using Babel may be very cool, but first I want to temper/curb your enthusiam for using Babel
in any serious/mission critical development environment. 

In effect, we wish to dissuade you from transpiling tests before you run them,
because this adds a big layer of complexity, which makes debugging even harder and sets yourself up 
for some weird transpilation related problems, no doubt.

Let's say that again - it's probably a bad idea to use Babel to transpile your tests. Here are our reasons:


1. Babel slows down development of tests, because running an individual test through Babel takes a lot more time, whether we transpile
 to a ```test-target``` directory first or use ```babel-register```, either way it's slower.
2. If you need to transpile a Suman test file, you obviously can't just run it with the node executable,
which is inconvenient at best. You will have to transpile it first, then run it with node.
This makes debugging harder, and it will make it much harder to run test coverage with Istanbul or the like.
3. Intriguingly, the ES7 async/await construct can be achieved directly via ES6 generators + Promises, 
so we recommend just using "plain-old" generator functions until ES7 is finalized and part of Node itself.*
4. Not all Babel features will make it into official ECMAScript versions, so there is some risk there.
5. As library authors, maintaining Suman to be compatible with future versions of node (aka, Babel features), 
is difficult and we simply cannot guarantee smooth sailing, in the same way we can with current versions of Node.
6. Let's face it, how many times have you accidentally edited the transpiled file instead of the src file, 
or tried to run the src file instead of the transpiled file? Yeah, me too.
(Webstorm does have a nice feature to help prevent this, see "Webstorm: mark as excluded"). Babel-register solves this problem,
but then there is very little transparency in your tests (because you can't easily see the actual source code), if you hit a bug or snafu.
8. In most production environments, the risk of adding the complexity of 


*Here is a description of how async/await can be achieved via generators:
<a href="https://www.promisejs.org/generators/"> (Promises + Generators) = async/await </a>

## Now, if you really want to run your Suman tests through Babel, even if it's just for experimentation, Suman supports this as a primary feature:


### The simpler and recommended way:

   Use this methodology if you want to:
   
    * transpile any or every .js file in your test directory
    * run tests upon a change to a test fixture
   

1. run ```$ suman --use-babel``` in your project root, this will install the correct Babel dependencies, as they are not included with the basic Suman installation, to save disk space.
2. either set ```transpile:true``` in your suman.conf.js file, or use the ```--transpile / -t``` option at the command line, we will assume latter for now
3. ensure that your directory structure is suitable for transpilation, see: 
4. run ```$ suman -t``` => this will transpile your test-src dir to test-target and then run all the files in test-target.

This will transpile/copy all the files in your test directory (specified by the testDir property in your suman.conf.js file, the default is "test") and move them to the testDirCopyDir value, by default this is "test-target", a top-level directory
in your project. After transpiling, it will execute all the test files in the test-target dir! 

In order to transpile only, and not execute the tests, you would use the --no-run flag, like so:

```suman -t --no-run``` 

Now you may be asking, ok, so that allows me to transpile once, but what if I want to transpile everytime I change a test file, or any file for that matter,
in the test directory?

You would issue this command:


```suman -t --no-run``` or ```suman -t --no-run``` 


The ```--watch / -w``` option incorporates the Suman server which will watch for changes to your files and transpile them on demand.
If you wish to run a test each time you save a change, then forgo the --no-run option, and use Suman like so:

```suman -t -w``` 



### The more complicated, but possibly cleaner way (not recommended):

Use this method if you
 
    * have a lot of files in your test directory
    * don't want yet another directory in the root of your project (this methodology allows us to move test-target out of the root of
    the project)
    
    

1. run ```$ suman --use-babel``` in your project root, this will install the correct Babel dependencies, as they are not included with the basic Suman installation.
2. either set transpile:true in your suman.conf.js file, or use the --transpile option at the command line, we will assume latter for now
3. ensure that the value for testDir in your suman.conf.js file, matches the top level directory that contains all of your test data, fixtures and test.js files.
4. Structure your test directory like so:

--test
  --/fixtures
  --/helpers
  --/src
   
 => fixtures contains all your test data (.json files etc), and static assets for testing.   
 => helpers contains JS files that are not actually to be run as tests
 => src contains all your .js test files, nested directories are allowed; anything that needs to be transpiled should go in here
 => as you may have figured out, we are only going to transpile contents from the test/src directory to test/target
 
 
4. run ```$ suman --transpile test/src/baz.test.js``` or ```$ suman -t test/src/baz.test.js```

What this will do is create a new directory at the same level as test/src, called test/target, and put the single transpiled baz.test.js file therein.

so your directory was like this before:

--test
  --/fixtures
  --/helpers
  --/src
    --one.test.js
    --two.test.js
    --baz.test.js
  
  
and now it looks like:


--test
  --/fixtures
  --/helpers
  --/src
    --one.test.js
    --two.test.js
    --baz.test.js
  --/target          <<<<<<<<< new dir, yay
    --baz.test.js    <<<<<<<<< we only transpiled one file, saving us some time
  
  
 It's imperative that you structure your test directory properly, and the above structure is advised. 
 Otherwise, use the easier transpilation option when first trying out transpilation with Suman, using the --all option.