# Reader-Writer Lock Decision Tree (Read-Preferring)

This document shows the decision flow for how clients and the broker handle reader-writer locks with read preference. Multiple readers can coexist, but writers are exclusive and wait for all readers to finish.

## Acquire Read Lock Flow

```mermaid
flowchart TD
    Start[Client: acquireReadLock request] --> ParseOpts[Parse lock options]
    ParseOpts --> LockReadKey[Lock read key<br/>with rwStatus=BeginRead]
    LockReadKey --> BrokerReceive[Broker: receive lock request]
    
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    CheckLockExists -->|No| CreateLock[Create new lock object<br/>with maxRead=10]
    CreateLock --> IncrementReaders[Increment readers count]
    IncrementReaders --> AddHolder[Add client to lockholders]
    AddHolder --> SendSuccess[Send success:<br/>acquired=true, readersCount]
    
    CheckLockExists -->|Yes| CheckReaders{readers + 1<br/>< maxRead?}
    CheckReaders -->|Yes| IncrementReaders
    CheckReaders -->|No| QueueRequest[Add to queue]
    QueueRequest --> SendQueued[Send queued:<br/>acquired=false]
    
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> CheckFirstReader{readersCount<br/>=== 1?}
    CheckFirstReader -->|Yes| LockWriteKey[Lock writeKey<br/>with force=true]
    LockWriteKey --> UnlockReadKey[Unlock read key]
    UnlockReadKey --> ReturnRelease[Return release function]
    CheckFirstReader -->|No| UnlockReadKey
    
    ReturnRelease --> End[Read lock acquired]
```

## Acquire Write Lock Flow

```mermaid
flowchart TD
    Start[Client: acquireWriteLock request] --> ParseOpts[Parse lock options]
    ParseOpts --> SetForce[Set force=true, max=1]
    SetForce --> LockWriteKey[Lock writeKey<br/>with rwStatus=BeginWrite]
    LockWriteKey --> BrokerReceive[Broker: receive lock request]
    
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    CheckLockExists -->|No| CreateLock[Create new lock object<br/>with maxWrite=1]
    CreateLock --> AddHolder[Add client to lockholders]
    AddHolder --> SendSuccess[Send success:<br/>acquired=true]
    
    CheckLockExists -->|Yes| CheckHolders{lockholders.size<br/>< maxWrite?}
    CheckHolders -->|Yes| AddHolder
    CheckHolders -->|No| CheckForce{Force<br/>option?}
    CheckForce -->|Yes| AddToFront[Add to front<br/>of queue]
    CheckForce -->|No| AddToBack[Add to back<br/>of queue]
    AddToFront --> SendQueued
    AddToBack --> SendQueued[Send queued:<br/>acquired=false]
    SendQueued --> WaitForNotify[Wait for notification]
    WaitForNotify --> BrokerNotify[Broker: notify next<br/>in queue]
    BrokerNotify --> CheckHolders
    
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> ReturnRelease[Return release function]
    ReturnRelease --> End[Write lock acquired]
```

## Release Read Lock Flow

```mermaid
flowchart TD
    Start[Client: releaseReadLock request] --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| DecrementReaders[Decrement readers count<br/>on broker]
    CheckBoundRelease -->|No| AcquireLock[Acquire lock first]
    AcquireLock --> DecrementReaders
    
    DecrementReaders --> BrokerDecrement[Broker: decrement readers]
    BrokerDecrement --> UnlockReadKey[Unlock read key]
    UnlockReadKey --> CheckLastReader{readersCount<br/>=== 0?}
    
    CheckLastReader -->|Yes| UnlockWriteKey[Unlock writeKey<br/>with force=true]
    UnlockWriteKey --> SendSuccess[Send success:<br/>unlocked=true]
    CheckLastReader -->|No| SendSuccess
    
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> End[Read lock released]
```

## Release Write Lock Flow

```mermaid
flowchart TD
    Start[Client: releaseWriteLock request] --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| UnlockWriteKey[Unlock writeKey<br/>with force=true]
    CheckBoundRelease -->|No| AcquireLock[Acquire lock first]
    AcquireLock --> UnlockWriteKey
    
    UnlockWriteKey --> BrokerUnlock[Broker: unlock writeKey]
    BrokerUnlock --> RemoveHolder[Remove client<br/>from lockholders]
    RemoveHolder --> CheckQueue{Queue has<br/>waiting clients?}
    
    CheckQueue -->|Yes| NotifyNext[Notify next client<br/>in queue]
    NotifyNext --> GrantLock[Grant lock to<br/>next client]
    GrantLock --> SendSuccess
    CheckQueue -->|No| SendSuccess[Send success:<br/>unlocked=true]
    
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> End[Write lock released]
```

