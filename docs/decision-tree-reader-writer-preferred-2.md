# Reader-Writer Lock Decision Tree (Write-Preferring)

This document shows the decision flow for how clients and the broker handle reader-writer locks with write preference. Writers have priority and block new readers from acquiring locks.

## Acquire Read Lock Flow

```mermaid
flowchart TD
    Start[Client: acquireReadLock request] --> ParseOpts[Parse lock options]
    ParseOpts --> CheckWriteFlag[Client: Check write flag<br/>via registerWriteFlagCheck]
    CheckWriteFlag --> BrokerCheck[Broker: register-write-flag-check]
    
    BrokerCheck --> WriteFlagSet{Write flag<br/>set?}
    WriteFlagSet -->|Yes| QueueRead[Broker: Queue read request<br/>in registeredListeners]
    QueueRead --> SendQueued[Broker: Send register-write-flag-check-queued]
    SendQueued --> WaitForWriter[Client: Wait for writer to finish]
    WaitForWriter --> WriterDone[Broker: Writer releases,<br/>sets flag=false, broadcasts]
    WriterDone --> IncrementReadersQueued[Broker: Increment readers<br/>in queued callback]
    IncrementReadersQueued --> SendSuccessQueued[Broker: Send register-write-flag-success]
    SendSuccessQueued --> AcquireLockQueued[Client: Proceed to acquire lock]
    
    WriteFlagSet -->|No| AcquireLock1[Client: Acquire base lock<br/>with maxRead=10]
    AcquireLockQueued --> AcquireLock2[Client: Acquire base lock<br/>with maxRead=10]
    
    AcquireLock1 --> BrokerCheckLock{Broker: Lock exists?}
    AcquireLock2 --> BrokerCheckLock
    
    BrokerCheckLock -->|No| CreateReadLock[Broker: Create new lock<br/>with maxRead=10]
    CreateReadLock --> GrantLock1[Broker: Grant lock]
    
    BrokerCheckLock -->|Yes| CheckMaxRead{Current readers<br/>< maxRead?}
    CheckMaxRead -->|Yes| GrantLock2[Broker: Grant lock]
    CheckMaxRead -->|No| QueueLock[Broker: Add to notify queue]
    QueueLock --> WaitLock[Client: Wait for lock]
    WaitLock --> GrantLock3[Broker: Grant lock when available]
    GrantLock3 --> IncrementReaders3
    
    GrantLock1 --> IncrementReaders1[Client: Call incrementReaders]
    GrantLock2 --> IncrementReaders2[Client: Call incrementReaders]
    
    IncrementReaders1 --> BrokerIncrement1[Broker: Increment readers count]
    IncrementReaders2 --> BrokerIncrement2[Broker: Increment readers count]
    IncrementReaders3 --> BrokerIncrement3[Broker: Increment readers count]
    
    BrokerIncrement1 --> ClientReadSuccess1[Client: Read lock acquired]
    BrokerIncrement2 --> ClientReadSuccess2[Client: Read lock acquired]
    BrokerIncrement3 --> ClientReadSuccess3[Client: Read lock acquired]
```

## Acquire Write Lock Flow

```mermaid
flowchart TD
    Start[Client: acquireWriteLock request] --> ParseOpts[Parse lock options]
    ParseOpts --> SetMax[Set max=1, maxWrite=1]
    SetMax --> AcquireBaseLock[Client: Acquire base lock<br/>with maxWrite=1]
    AcquireBaseLock --> BrokerCheckLock2{Broker: Lock exists?}
    
    BrokerCheckLock2 -->|No| CreateWriteLock[Broker: Create new lock<br/>with maxWrite=1]
    CreateWriteLock --> GrantBaseLock1[Broker: Grant base lock]
    
    BrokerCheckLock2 -->|Yes| CheckMaxWrite{Current lockholders<br/>< maxWrite?}
    CheckMaxWrite -->|Yes| GrantBaseLock2[Broker: Grant base lock]
    CheckMaxWrite -->|No| QueueWrite[Broker: Add to notify queue]
    QueueWrite --> WaitBaseLock[Client: Wait for base lock]
    WaitBaseLock --> GrantBaseLock3[Broker: Grant base lock when available]
    GrantBaseLock3 --> CheckFlagAndReaders
    
    GrantBaseLock1 --> CheckFlagAndReaders[Client: Call registerWriteFlagAndReadersCheck]
    GrantBaseLock2 --> CheckFlagAndReaders
    
    CheckFlagAndReaders --> BrokerCheckBoth{Broker: writerFlag set<br/>OR readers > 0?}
    
    BrokerCheckBoth -->|Yes| QueueWriteFlag[Broker: Queue in registeredListeners]
    QueueWriteFlag --> WaitForReaders[Client: Wait for readers to finish]
    WaitForReaders --> ReadersDone[Broker: Last reader decrements,<br/>broadcasts]
    ReadersDone --> SetFlagQueued[Broker: Set writerFlag=true<br/>in queued callback]
    SetFlagQueued --> SendSuccessFlag[Broker: Send register-write-flag-and-readers-check-success]
    SendSuccessFlag --> AddHolder1[Broker: Add client to lockholders]
    AddHolder1 --> SendSuccess1[Broker: Send acquired=true]
    SendSuccess1 --> ClientWriteSuccess1[Client: Write lock acquired]
    
    BrokerCheckBoth -->|No| SetFlagImmediate[Broker: Set writerFlag=true immediately]
    SetFlagImmediate --> SendSuccessFlag2[Broker: Send register-write-flag-and-readers-check-success]
    SendSuccessFlag2 --> AddHolder2[Broker: Add client to lockholders]
    AddHolder2 --> SendSuccess2[Broker: Send acquired=true]
    SendSuccess2 --> ClientWriteSuccess2[Client: Write lock acquired]
```

## Release Read Lock Flow

```mermaid
flowchart TD
    Start[Client: releaseReadLock request] --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| DecrementReaders[Client: Call decrementReaders]
    CheckBoundRelease -->|No| DecrementReaders
    
    DecrementReaders --> BrokerDecrement{Broker: Decrement readers count}
    BrokerDecrement --> CheckReadersZero{readers === 0?}
    
    CheckReadersZero -->|Yes| BroadcastIfListeners{Broker: Are there<br/>registeredListeners?}
    BroadcastIfListeners -->|Yes| Broadcast1[Broker: Broadcast to<br/>waiting writers]
    BroadcastIfListeners -->|No| NoBroadcast[Broker: Skip broadcast]
    
    Broadcast1 --> UnlockBase[Client: Unlock base lock]
    NoBroadcast --> UnlockBase
    
    CheckReadersZero -->|No| Noop1[No operation:<br/>Other readers still active]
    Noop1 --> UnlockBase
    
    UnlockBase --> RemoveLockholder[Broker: Remove lockholder]
    RemoveLockholder --> SendUnlockSuccess[Broker: Send unlocked=true]
    SendUnlockSuccess --> ClientReadReleased[Client: Read lock released]
```

## Release Write Lock Flow

```mermaid
flowchart TD
    Start[Client: releaseWriteLock request] --> CheckBoundRelease{Has bound<br/>release function?}
    CheckBoundRelease -->|Yes| UnlockBaseWrite[Client: Unlock base lock]
    CheckBoundRelease -->|No| UnlockBaseWrite
    
    UnlockBaseWrite --> RemoveWriteLockholder[Broker: Remove write lockholder]
    RemoveWriteLockholder --> SetFlagFalse[Client: Call setWriteFlagToFalse]
    SetFlagFalse --> BrokerSetFalse[Broker: Set writerFlag=false]
    BrokerSetFalse --> Broadcast2[Broker: Broadcast to waiting readers]
    Broadcast2 --> NotifyReaders[Broker: Notify queued readers<br/>via callbacks]
    NotifyReaders --> CheckQueue{Queue has<br/>waiting writers?}
    
    CheckQueue -->|Yes| NotifyNextWriter[Broker: Notify next writer<br/>in queue]
    NotifyNextWriter --> GrantLock[Broker: Grant lock to<br/>next writer]
    GrantLock --> SendSuccessWriter[Broker: Send acquired=true<br/>to next writer]
    SendSuccessWriter --> SendUnlockSuccess[Broker: Send unlocked=true<br/>to releasing client]
    SendUnlockSuccess --> ClientWriteReleased[Client: Write lock released]
    
    CheckQueue -->|No| SendUnlockSuccess2[Broker: Send unlocked=true]
    SendUnlockSuccess2 --> ClientWriteReleased
```

