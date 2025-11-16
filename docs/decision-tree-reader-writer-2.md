# Reader-Writer Lock Decision Tree (Read-Preferring)

This document shows the complete decision flow for how clients and the broker handle reader-writer locks with read preference. Multiple readers can coexist, but writers are exclusive and wait for all readers to finish.

## Acquire Read Lock Flow

```mermaid
flowchart TD
    Start([Client: Acquire Read Lock]) --> ParseOpts[Client: Parse lock options]
    ParseOpts --> SendReadReq[Client sends lock request<br/>with rwStatus=BeginRead]
    SendReadReq --> BrokerReceive[Broker: receive lock request]
    
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    CheckLockExists -->|No| CreateReadLock[Broker: Create new lock object<br/>with maxRead=10]
    CreateReadLock --> IncrementReaders1[Broker: Increment readers count]
    IncrementReaders1 --> AddHolder1[Broker: Add client to lockholders]
    AddHolder1 --> SendSuccess1[Broker: Send success:<br/>acquired=true, readersCount]
    
    CheckLockExists -->|Yes| CheckReaders{readers + 1<br/>< maxRead?}
    CheckReaders -->|Yes| IncrementReaders2[Broker: Increment readers count]
    IncrementReaders2 --> AddHolder2[Broker: Add client to lockholders]
    AddHolder2 --> SendSuccess2[Broker: Send success:<br/>acquired=true, readersCount]
    
    CheckReaders -->|No| QueueRead[Broker: Add to notify queue]
    QueueRead --> SendQueued[Broker: Send queued:<br/>acquired=false]
    SendQueued --> WaitRead[Client: Wait for notification]
    WaitRead --> BrokerNotify[Broker: Grant lock when available]
    BrokerNotify --> CheckReaders
    
    SendSuccess1 --> ClientSuccess1[Client: receive success]
    SendSuccess2 --> ClientSuccess2[Client: receive success]
    ClientSuccess1 --> CheckFirstReader{readersCount<br/>=== 1?}
    ClientSuccess2 --> CheckFirstReader
    
    CheckFirstReader -->|Yes| LockWriteKey[Client: Lock writeKey<br/>with force=true]
    LockWriteKey --> UnlockReadKey1[Client: Unlock read key]
    UnlockReadKey1 --> ReturnRelease1[Client: Return release function]
    
    CheckFirstReader -->|No| UnlockReadKey2[Client: Unlock read key]
    UnlockReadKey2 --> ReturnRelease2[Client: Return release function]
    
    ReturnRelease1 --> End[Read lock acquired]
    ReturnRelease2 --> End
```

## Acquire Write Lock Flow

```mermaid
flowchart TD
    Start([Client: Acquire Write Lock]) --> ParseOpts[Client: Parse lock options]
    ParseOpts --> SetForce[Client: Set force=true, max=1]
    SetForce --> SendWriteReq[Client sends lock request<br/>with rwStatus=BeginWrite, force=true]
    SendWriteReq --> BrokerReceive[Broker: receive lock request]
    
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    CheckLockExists -->|No| CreateWriteLock[Broker: Create new lock object<br/>with maxWrite=1]
    CreateWriteLock --> AddHolder1[Broker: Add client to lockholders]
    AddHolder1 --> SendSuccess1[Broker: Send success:<br/>acquired=true]
    
    CheckLockExists -->|Yes| CheckHolders{lockholders.size<br/>< maxWrite?}
    CheckHolders -->|Yes| AddHolder2[Broker: Add client to lockholders]
    AddHolder2 --> SendSuccess2[Broker: Send success:<br/>acquired=true]
    
    CheckHolders -->|No| CheckForce{Force<br/>option?}
    CheckForce -->|Yes| AddToFront[Broker: Add to front<br/>of queue]
    CheckForce -->|No| AddToBack[Broker: Add to back<br/>of queue]
    AddToFront --> SendQueued
    AddToBack --> SendQueued[Broker: Send queued:<br/>acquired=false]
    SendQueued --> WaitWrite[Client: Wait for notification]
    WaitWrite --> BrokerNotify[Broker: notify next<br/>in queue]
    BrokerNotify --> CheckHolders
    
    SendSuccess1 --> ClientSuccess1[Client: receive success]
    SendSuccess2 --> ClientSuccess2[Client: receive success]
    ClientSuccess1 --> ReturnRelease1[Client: Return release function]
    ClientSuccess2 --> ReturnRelease2[Client: Return release function]
    ReturnRelease1 --> End[Write lock acquired]
    ReturnRelease2 --> End
```

## Release Read Lock Flow

```mermaid
flowchart TD
    Start([Client: Release Read Lock]) --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| LockForDecrement[Client: Acquire lock<br/>with rwStatus=EndRead]
    CheckBoundRelease -->|No| AcquireLock[Client: Acquire lock first]
    AcquireLock --> LockForDecrement
    
    LockForDecrement --> BrokerReceive[Broker: receive lock request]
    BrokerReceive --> DecrementReaders[Broker: Decrement readers count]
    DecrementReaders --> UnlockReadKey[Client: Unlock read key]
    UnlockReadKey --> CheckLastReader{readersCount<br/>=== 0?}
    
    CheckLastReader -->|Yes| UnlockWriteKey[Client: Unlock writeKey<br/>with force=true]
    UnlockWriteKey --> BrokerUnlock[Broker: Remove lockholder]
    BrokerUnlock --> SendSuccess1[Broker: Send success:<br/>unlocked=true]
    SendSuccess1 --> ClientSuccess1[Client: receive success]
    ClientSuccess1 --> End1[Read lock released]
    
    CheckLastReader -->|No| Noop1[No operation: Other readers still active]
    Noop1 --> BrokerUnlock2[Broker: Remove lockholder]
    BrokerUnlock2 --> SendSuccess2[Broker: Send success:<br/>unlocked=true]
    SendSuccess2 --> ClientSuccess2[Client: receive success]
    ClientSuccess2 --> End2[Read lock released]
```

## Release Write Lock Flow

```mermaid
flowchart TD
    Start([Client: Release Write Lock]) --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| SendUnlockWrite[Client sends unlock<br/>with rwStatus=EndWrite, force=true]
    CheckBoundRelease -->|No| AcquireLock[Client: Acquire lock first]
    AcquireLock --> SendUnlockWrite
    
    SendUnlockWrite --> BrokerReceive[Broker: receive unlock request]
    BrokerReceive --> RemoveWriteLockholder[Broker: Remove client<br/>from lockholders]
    RemoveWriteLockholder --> CheckQueue{Queue has<br/>waiting clients?}
    
    CheckQueue -->|Yes| NotifyNext[Broker: Notify next client<br/>in queue]
    NotifyNext --> GrantLock[Broker: Grant lock to<br/>next client]
    GrantLock --> SendSuccess1[Broker: Send success:<br/>acquired=true to next client]
    SendSuccess1 --> SendUnlockSuccess[Broker: Send success:<br/>unlocked=true to releasing client]
    SendUnlockSuccess --> ClientSuccess1[Client: receive success]
    ClientSuccess1 --> End1[Write lock released]
    
    CheckQueue -->|No| SendUnlockSuccess2[Broker: Send success:<br/>unlocked=true]
    SendUnlockSuccess2 --> ClientSuccess2[Client: receive success]
    ClientSuccess2 --> End2[Write lock released]
```

