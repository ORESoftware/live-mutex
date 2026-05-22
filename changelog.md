
# Live-Mutex Change-Log

-------------------------------------------------------------

## Sat Aug 31 17:11:42 PDT 2019

* The typings will no longer accept primitive arguments to options objects. For example:

    client.lock(key, true)
    
    it has to be:
    
    client.lock(key, {force:true})
    
    or for the short-run:
    
    client.lock(key, <any>true);
    
    in a 1.0.0 release, the primitive options will be removed altogether.


*   The following methods are deprecated:

    lockp(key: string, opts?: Partial<LMXClientLockOpts>): Promise<LMLockSuccessData> {
      log.warn('lockp is deprecated because it is a confusing method name, use acquire/acquireLock instead.');
      return this.acquire.apply(this, <any>arguments);
    }
    
    unlockp(key: string, opts: Partial<LMXClientUnlockOpts>): Promise<LMUnlockSuccessData> {
      log.warn('unlockp is deprecated because it is a confusing method name, use release/releaseLock instead.');
      return this.release.apply(this, <any>arguments);
    }


## Mon Aug 26 18:19:32 PDT 2019

### changed:

removed async, handlebars, lodash
because of vulnerabilities and because their install size was massive.
For testing, we need async, so we now have test/setup-test.sh
in order to install the proper test deps, instead of using optionalDependencies in package.json.


## Sat Jul 27 21:03:20 PDT 2019

### changed:

Updated @oresoftware/linked-queue patch version

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
    
    
----------------------------------------------------------# Live-Mutex Change-Log (Updated for Reader-Writer Locks feature branch bca9d481-fdcd-4586-aa98-b20ede600396 / task 1b84c549-34e5-4141-bf9a-d9796b3637c2) 2024-10-XX TBD release (v0.3.x+ or next minor)  * Added comprehensive support for Reader-Writer locks (read-preferring and write-preferring modes)  * New decision tree documentation for RW lock flows (acquire/release for readers/writers)  * Updated compilation guide and related docs  * Broker and client enhancements for rwStatus handling (BeginRead/EndRead, BeginWrite/EndWrite)  * Force options and queue management for exclusive write access  * Multi-reader concurrency with maxRead limits and write-key coordination   -------------------------------------------------------------  