You can easily convert a single Mocha test or directory of Mocha tests to Suman tests with the following command:

<br>
<span style="background-color:#9ACD32">&nbsp;```$ suman --convert --src=[src-dir/src-file] --dest=[dest-dir]```</span>
<br>
<br>

### Making the switch, taking the plunge

The best steps to start making the switch from Mocha to Suman are as follows: 

1. Create a commit or tag before you do anything further; the commit message might be "last commit pre-suman-conversion"

2. Rename your "test" directory to "test-old" or whatever your test directory is called if it's not "test"

    => ```mv test test-old```   // or ```git mv test test-old``` (this will automatically stage the change)

3. <span style="background-color:#9ACD32">&nbsp;```$ suman --convert test-old test```</span>

This should run very quickly, much less than 1 second. Now you have Suman tests replacing 
all your Mocha tests in your original test directory!

You can compare the new Suman tests with the old Mocha tests in test-old for awhile, for reference. 
Please be aware of the common catches and caveats associated with converting Mocha tests to Suman tests, below. 
We are working on making the conversion close to 100% reliable.


##  Here are the current pitfalls and caveats with regard to converting from Mocha to Suman:


Suman test cases and hooks use a singular param t (t itself is an error-first callback and callback functions belong to the t function-object, 
and they can be called in any context, without problem).


1. Problem caused by: hooks that forgo the anonymous wrapper function

normally we have:

```js

before(function(done){    //mocha version
  someHelperFn(done);
});


this.before.cb(t => {     //suman equivalent
  someHelperFn(t);
});


```

 