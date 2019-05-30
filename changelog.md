

# Live-Mutex Change-Log

-------------------------------------------------------------


## Wed May 29 22:22:30 PDT 2019


### changed:

No longer supporting Node.js 6 or 7.
Node.js 8+ supported.


### removed:

Remove the following deps from optionalDependencies:

```
 "node-redis-warlock": "^0.2.0",
 "redis": "^2.6.3"
```
 
the former had a minor security vulnerability in the "extend" package
    
    
----------------------------------------------------------