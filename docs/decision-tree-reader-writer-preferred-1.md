# Reader-Writer Lock Decision Tree (Write-Preferring)

This document shows the decision flow for how clients and the broker handle reader-writer locks with write preference. Writers have priority and block new readers from acquiring locks.

## Acquire Read Lock Flow

```mermaid
flowchart TD
    Start[Client: acquireReadLock request] --> ParseOpts[Parse lock options]
    ParseOpts --> CheckWriteFlag[Check write flag<br/>on broker]
    CheckWriteFlag --> BrokerCheck[Broker: register-write-flag-check]
    
    BrokerCheck --> WriteFlagSet{Write flag<br/>set?}
    WriteFlagSet -->|Yes| QueueRead[Queue read request<br/>wait for flag=false]
    QueueRead --> WaitForBroadcast[Wait for broadcast<br/>from writer release]
    WaitForBroadcast --> WriteFlagSet
    
    WriteFlagSet -->|No| LockReadKey[Lock read key<br/>with rwStatus=BeginRead]
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
    ClientSuccess --> IncrementReadersCount[Increment readers count<br/>on broker]
    IncrementReadersCount --> ReturnRelease[Return release function]
    ReturnRelease --> End[Read lock acquired]
```

## Acquire Write Lock Flow

```mermaid
flowchart TD
    Start[Client: acquireWriteLock request] --> ParseOpts[Parse lock options]
    ParseOpts --> SetMax[Set max=1, maxWrite=1]
    SetMax --> LockWriteKey[Lock writeKey<br/>with rwStatus=BeginWrite]
    LockWriteKey --> BrokerReceive[Broker: receive lock request]
    
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    CheckLockExists -->|No| CreateLock[Create new lock object<br/>with maxWrite=1]
    CreateLock --> RegisterWriteFlag[Register write flag<br/>and check readers]
    RegisterWriteFlag --> CheckReaders{Active<br/>readers?}
    
    CheckLockExists -->|Yes| CheckHolders{lockholders.size<br/>< maxWrite?}
    CheckHolders -->|Yes| RegisterWriteFlag
    CheckHolders -->|No| QueueRequest[Add to queue]
    QueueRequest --> SendQueued[Send queued:<br/>acquired=false]
    SendQueued --> WaitForNotify[Wait for notification]
    WaitForNotify --> BrokerNotify[Broker: notify next<br/>in queue]
    BrokerNotify --> CheckHolders
    
    CheckReaders -->|Yes| WaitForReaders[Wait for all readers<br/>to finish]
    WaitForReaders --> SetWriteFlag[Set write flag=true]
    CheckReaders -->|No| SetWriteFlag[Set write flag=true]
    
    SetWriteFlag --> AddHolder[Add client to lockholders]
    AddHolder --> SendSuccess[Send success:<br/>acquired=true]
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
    UnlockReadKey --> SendSuccess[Send success:<br/>unlocked=true]
    
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> End[Read lock released]
```

## Release Write Lock Flow

```mermaid
flowchart TD
    Start[Client: releaseWriteLock request] --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| UnlockWriteKey[Unlock writeKey]
    CheckBoundRelease -->|No| AcquireLock[Acquire lock first]
    AcquireLock --> UnlockWriteKey
    
    UnlockWriteKey --> BrokerUnlock[Broker: unlock writeKey]
    BrokerUnlock --> RemoveHolder[Remove client<br/>from lockholders]
    RemoveHolder --> SetWriteFlagFalse[Set write flag=false<br/>and broadcast]
    
    SetWriteFlagFalse --> BroadcastToReaders[Broadcast to queued<br/>readers]
    BroadcastToReaders --> NotifyReaders[Notify all waiting<br/>readers]
    NotifyReaders --> CheckQueue{Queue has<br/>waiting writers?}
    
    CheckQueue -->|Yes| NotifyNextWriter[Notify next writer<br/>in queue]
    NotifyNextWriter --> GrantLock[Grant lock to<br/>next writer]
    GrantLock --> SendSuccess
    CheckQueue -->|No| SendSuccess[Send success:<br/>unlocked=true]
    
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> End[Write lock released]
```

