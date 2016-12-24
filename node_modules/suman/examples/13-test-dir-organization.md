The optimal way to organize your test directory for Suman usage is as follows:


```
--test
---/.suman
---/fixtures
---/test-src
```


src contains your test files, and if you want to transpile them, the directory structure will look like:

```
--test
---/.suman
---/fixtures
---/test-src
---/test-target
```

otherwise, if you have something like this, and you want to transpile the whole directory:

```
--test
---/.suman
---/fixtures
---/unit-testing
---/integration-testing
```

transpiling becomes:

```
--test
---/.suman
---/fixtures
---/unit-testing
---/integration-testing

--test-target
---/.suman
---/fixtures
---/unit-testing
---/integration-testing
```

so you have copied over a bunch of files that probably don't need transpilation, in fixtures, etc.

