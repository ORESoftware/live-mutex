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
    SendQueued --> WaitRead[Client: Wait for notification]
    WaitRead --> GrantRead[Broker: Grant lock when available]
    GrantRead --> IncrementReaders
    
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> CheckFirstReader{readersCount<br/>=== 1?}
    CheckFirstReader -->|Yes| LockWriteKey[Client: Lock writeKey<br/>with force=true]
    LockWriteKey --> UnlockReadKey[Client: Unlock read lock immediately]
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
    CheckHolders -->|No| QueueWrite[Broker: Add to front of queue<br/>with force]
    QueueWrite --> SendQueued[Send queued:<br/>acquired=false]
    SendQueued --> WaitWrite[Client: Wait for notification]
    WaitWrite --> GrantWrite[Broker: Grant lock when available]
    GrantWrite --> AddHolder
    
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> ReturnRelease[Return release function]
    ReturnRelease --> End[Write lock acquired]
```

## Release Read Lock Flow

```mermaid
flowchart TD
    Start[Client: releaseReadLock request] --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| LockForDecrement[Client: Acquire lock<br/>with rwStatus=EndRead]
    CheckBoundRelease -->|No| LockForDecrement
    
    LockForDecrement --> BrokerDecrement[Broker: Decrement readers count]
    BrokerDecrement --> UnlockReadKey[Client: Unlock read lock]
    UnlockReadKey --> CheckLastReader{Is last reader?<br/>readers === 0}
    
    CheckLastReader -->|Yes| UnlockWriteKey[Client: Unlock writeKey<br/>with force=true]
    UnlockWriteKey --> ClientReadReleased[Client: Read lock released]
    
    CheckLastReader -->|No| Noop1[No operation:<br/>Other readers still active]
    Noop1 --> ClientReadReleased
```

## Release Write Lock Flow

```mermaid
flowchart TD
    Start[Client: releaseWriteLock request] --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| SendUnlockWrite[Client sends unlock<br/>with rwStatus=EndWrite, force=true]
    CheckBoundRelease -->|No| SendUnlockWrite
    
    SendUnlockWrite --> BrokerUnlock[Broker: Remove write lockholder]
    BrokerUnlock --> RemoveWriteLockholder[Broker: Remove from lockholders]
    RemoveWriteLockholder --> CheckQueue{Queue has<br/>waiting clients?}
    
    CheckQueue -->|Yes| NotifyNext[Broker: Grant lock to<br/>next waiter if any]
    NotifyNext --> SendSuccessNext[Broker: Send acquired=true<br/>to next client]
    SendSuccessNext --> SendUnlockSuccess[Broker: Send unlocked=true<br/>to releasing client]
    SendUnlockSuccess --> ClientWriteReleased[Client: Write lock released]
    
    CheckQueue -->|No| SendUnlockSuccess2[Broker: Send unlocked=true]
    SendUnlockSuccess2 --> ClientWriteReleased
```

