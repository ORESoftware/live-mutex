Here we demonstrate why some new features of Suman are needed.

We need to use the value option of a test case, and the t.data object to pass data between test cases and hooks.

If we used shared scope to store data, it may get shared between different test cases which will result in

a test failure.

We don't want to share data when running test cases / hooks in parallel, because this absolutely introduces race
conditions.

We don't necessarily need to create more copies of data, we simply need to attach the right data to the right place.

Similar to how we attach data to req in Express.