# Reader-Writer Write-Preferred Lock Decision Tree

This document shows the complete decision flow for how clients and the broker handle reader-writer locks with write preference. Writers have priority and block new readers from acquiring locks.

## Acquire Read Lock Flow

```mermaid
flowchart TD
    Start([Client: Acquire Read Lock]) --> ParseOpts[Client: Parse lock options]
    ParseOpts --> CheckWriteFlag[Client: Check writer flag<br/>via registerWriteFlagCheck]
    CheckWriteFlag --> BrokerCheck[Broker: register-write-flag-check]
    
    BrokerCheck --> WriteFlagSet{Write flag<br/>set?}
    WriteFlagSet -->|Yes| QueueRead[Broker: Queue read request<br/>in registeredListeners]
    QueueRead --> SendQueued[Broker: Send register-write-flag-check-queued]
    SendQueued --> WaitForBroadcast[Client: Wait for broadcast<br/>from writer release]
    WaitForBroadcast --> WriterDone[Broker: Writer releases,<br/>sets flag=false, broadcasts]
    WriterDone --> IncrementReadersQueued[Broker: Increment readers<br/>in queued callback]
    IncrementReadersQueued --> SendSuccessQueued[Broker: Send register-write-flag-success]
    SendSuccessQueued --> AcquireLockQueued[Client: Proceed to acquire lock]
    
    WriteFlagSet -->|No| AcquireLock1[Client: Acquire base lock<br/>with maxRead=10]
    AcquireLockQueued --> AcquireLock2[Client: Acquire base lock<br/>with maxRead=10]
    
    AcquireLock1 --> BrokerReceive[Broker: receive lock request]
    AcquireLock2 --> BrokerReceive
    
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    CheckLockExists -->|No| CreateReadLock[Broker: Create new lock object<br/>with maxRead=10]
    CreateReadLock --> GrantLock1[Broker: Grant lock]
    
    CheckLockExists -->|Yes| CheckReaders{readers + 1<br/>< maxRead?}
    CheckReaders -->|Yes| GrantLock2[Broker: Grant lock]
    CheckReaders -->|No| QueueLock[Broker: Add to notify queue]
    QueueLock --> WaitLock[Client: Wait for lock]
    WaitLock --> BrokerNotify[Broker: Grant lock when available]
    BrokerNotify --> CheckReaders
    
    GrantLock1 --> SendSuccess1[Broker: Send success:<br/>acquired=true]
    GrantLock2 --> SendSuccess2[Broker: Send success:<br/>acquired=true]
    SendSuccess1 --> ClientSuccess1[Client: receive success]
    SendSuccess2 --> ClientSuccess2[Client: receive success]
    
    ClientSuccess1 --> IncrementReaders1[Client: Call incrementReaders]
    ClientSuccess2 --> IncrementReaders2[Client: Call incrementReaders]
    IncrementReaders1 --> BrokerIncrement1[Broker: Increment readers count]
    IncrementReaders2 --> BrokerIncrement2[Broker: Increment readers count]
    BrokerIncrement1 --> ReturnRelease1[Client: Return release function]
    BrokerIncrement2 --> ReturnRelease2[Client: Return release function]
    ReturnRelease1 --> End[Read lock acquired]
    ReturnRelease2 --> End
```

## Acquire Write Lock Flow

```mermaid
flowchart TD
    Start([Client: Acquire Write Lock]) --> ParseOpts[Client: Parse lock options]
    ParseOpts --> SetMax[Client: Set max=1, maxWrite=1]
    SetMax --> AcquireBaseLock[Client: Acquire base lock<br/>with maxWrite=1]
    AcquireBaseLock --> BrokerReceive[Broker: receive lock request]
    
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    CheckLockExists -->|No| CreateWriteLock[Broker: Create new lock object<br/>with maxWrite=1]
    CreateWriteLock --> GrantBaseLock1[Broker: Grant base lock]
    
    CheckLockExists -->|Yes| CheckHolders{lockholders.size<br/>< maxWrite?}
    CheckHolders -->|Yes| GrantBaseLock2[Broker: Grant base lock]
    CheckHolders -->|No| QueueWrite[Broker: Add to notify queue]
    QueueWrite --> SendQueued[Broker: Send queued:<br/>acquired=false]
    SendQueued --> WaitBaseLock[Client: Wait for base lock]
    WaitBaseLock --> BrokerNotify[Broker: Grant base lock when available]
    BrokerNotify --> CheckHolders
    
    GrantBaseLock1 --> CheckFlagAndReaders[Client: Call registerWriteFlagAndReadersCheck]
    GrantBaseLock2 --> CheckFlagAndReaders
    
    CheckFlagAndReaders --> BrokerCheckBoth{Broker: writerFlag set<br/>OR readers > 0?}
    
    BrokerCheckBoth -->|Yes| QueueWriteFlag[Broker: Queue in registeredListeners]
    QueueWriteFlag --> WaitForReaders[Client: Wait for readers to finish]
    WaitForReaders --> ReadersDone[Broker: Last reader decrements,<br/>broadcasts]
    ReadersDone --> SetFlagQueued[Broker: Set writerFlag=true<br/>in queued callback]
    SetFlagQueued --> SendSuccessFlag1[Broker: Send register-write-flag-and-readers-check-success]
    SendSuccessFlag1 --> ClientSuccess1[Client: receive success]
    ClientSuccess1 --> ReturnRelease1[Client: Return release function]
    ReturnRelease1 --> End1[Write lock acquired]
    
    BrokerCheckBoth -->|No| SetFlagImmediate[Broker: Set writerFlag=true immediately]
    SetFlagImmediate --> SendSuccessFlag2[Broker: Send register-write-flag-and-readers-check-success]
    SendSuccessFlag2 --> ClientSuccess2[Client: receive success]
    ClientSuccess2 --> ReturnRelease2[Client: Return release function]
    ReturnRelease2 --> End2[Write lock acquired]
```

## Release Read Lock Flow

```mermaid
flowchart TD
    Start([Client: Release Read Lock]) --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| DecrementReaders[Client: Call decrementReaders]
    CheckBoundRelease -->|No| AcquireLock[Client: Acquire lock first]
    AcquireLock --> DecrementReaders
    
    DecrementReaders --> BrokerDecrement[Broker: Decrement readers count]
    BrokerDecrement --> CheckReadersZero{readers === 0?}
    
    CheckReadersZero -->|Yes| BroadcastIfListeners{Broker: Are there<br/>registeredListeners?}
    BroadcastIfListeners -->|Yes| Broadcast1[Broker: Broadcast to<br/>waiting writers]
    BroadcastIfListeners -->|No| NoBroadcast[Broker: Skip broadcast]
    
    Broadcast1 --> UnlockBase1[Client: Unlock base lock]
    NoBroadcast --> UnlockBase2[Client: Unlock base lock]
    
    CheckReadersZero -->|No| Noop1[No operation: Other readers still active]
    Noop1 --> UnlockBase3[Client: Unlock base lock]
    
    UnlockBase1 --> RemoveLockholder1[Broker: Remove lockholder]
    UnlockBase2 --> RemoveLockholder2[Broker: Remove lockholder]
    UnlockBase3 --> RemoveLockholder3[Broker: Remove lockholder]
    RemoveLockholder1 --> SendSuccess1[Broker: Send success:<br/>unlocked=true]
    RemoveLockholder2 --> SendSuccess2[Broker: Send success:<br/>unlocked=true]
    RemoveLockholder3 --> SendSuccess3[Broker: Send success:<br/>unlocked=true]
    SendSuccess1 --> ClientSuccess1[Client: receive success]
    SendSuccess2 --> ClientSuccess2[Client: receive success]
    SendSuccess3 --> ClientSuccess3[Client: receive success]
    ClientSuccess1 --> End[Read lock released]
    ClientSuccess2 --> End
    ClientSuccess3 --> End
```

## Release Write Lock Flow

```mermaid
flowchart TD
    Start([Client: Release Write Lock]) --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| UnlockBaseWrite[Client: Unlock base lock]
    CheckBoundRelease -->|No| AcquireLock[Client: Acquire lock first]
    AcquireLock --> UnlockBaseWrite
    
    UnlockBaseWrite --> BrokerUnlock[Broker: Remove write lockholder]
    BrokerUnlock --> SetFlagFalse[Client: Call setWriteFlagToFalse]
    SetFlagFalse --> BrokerSetFalse[Broker: Set writerFlag=false]
    BrokerSetFalse --> Broadcast2[Broker: Broadcast to waiting readers]
    Broadcast2 --> NotifyReaders[Broker: Notify queued readers<br/>via callbacks]
    NotifyReaders --> CheckQueue{Queue has<br/>waiting writers?}
    
    CheckQueue -->|Yes| NotifyNextWriter[Broker: Notify next writer<br/>in queue]
    NotifyNextWriter --> GrantLock[Broker: Grant lock to<br/>next writer]
    GrantLock --> SendSuccess1[Broker: Send success:<br/>acquired=true to next writer]
    SendSuccess1 --> SendUnlockSuccess1[Broker: Send success:<br/>unlocked=true to releasing client]
    SendUnlockSuccess1 --> ClientSuccess1[Client: receive success]
    ClientSuccess1 --> End1[Write lock released]
    
    CheckQueue -->|No| SendUnlockSuccess2[Broker: Send success:<br/>unlocked=true]
    SendUnlockSuccess2 --> ClientSuccess2[Client: receive success]
    ClientSuccess2 --> End2[Write lock released]
```

