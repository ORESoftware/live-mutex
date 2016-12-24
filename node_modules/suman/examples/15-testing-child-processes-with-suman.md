

# Using Suman to Test Child Processes

If your test code launches a child-process and there is a fatal error in your test, the Suman test process will die,
which means the child-processes launched by your test file will die also, unless they are detached processes.

