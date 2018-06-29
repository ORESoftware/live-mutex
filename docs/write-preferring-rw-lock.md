

Using a condition variable and a mutex

A write-preferring R/W lock can be implemented in terms of a condition variable and an ordinary (mutex) lock, in addition to an integer counter and a boolean flag.

Input: mutex m, condition variable c, integer r (number of readers waiting), flag w (writer waiting).


<b>The lock-for-read operation:</b>

```
Lock m
While w:
    wait c, m
Increment r.
Unlock m.
```


<b>The lock-for-write operation is similar, but slightly different (inputs are the same as for lock-for-read)</b>

```
Lock m
While (w or r > 0):
    wait c, m
Set w to true.
Unlock m.
```


<b>The unlock-for-read (Releasing a read lock):</b>

```
Lock m
decrement r
signalling c if r has become zero
unlock m
```


<b>The unlock-for-write (Releasing a write lock):</b>

```
Lock m
set w to false
broadcast on c
unlock m
```