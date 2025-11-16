# Standard Lock Decision Tree

This document shows the complete decision flow for how clients and the broker handle standard (non-reader-writer) lock acquisition and release, including both client-side validation and broker-side processing.

## Acquire Lock Flow

```mermaid
flowchart TD
    Start([Client: Acquire Lock]) --> CheckConnection{Connection<br/>open?}
    CheckConnection -->|No| Error1[Return error:<br/>ConnectionClosed]
    CheckConnection -->|Yes| CheckRecovering{Connection<br/>recovering?}
    CheckRecovering -->|Yes| Error2[Return error:<br/>ConnectionRecovering]
    CheckRecovering -->|No| SendRequest[Client sends lock request<br/>to broker]
    
    SendRequest --> BrokerReceive[Broker: receive lock request]
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    
    CheckLockExists -->|No| CreateLock[Broker: Create new lock object]
    CreateLock --> AddHolder[Broker: Add client to lockholders]
    AddHolder --> SetTTL{TTL<br/>specified?}
    SetTTL -->|Yes| StartTimer[Broker: Start TTL timer]
    SetTTL -->|No| SendSuccess1
    StartTimer --> SendSuccess1[Broker: Send success:<br/>acquired=true]
    SendSuccess1 --> ClientSuccess1[Client: receive success]
    ClientSuccess1 --> ReturnUnlock[Client: Return unlock function]
    ReturnUnlock --> End1[Lock acquired]
    
    CheckLockExists -->|Yes| CheckCount{Current holders<br/>< max?}
    CheckCount -->|Yes| AddHolder
    CheckCount -->|No| CheckForce{Force<br/>option?}
    CheckForce -->|Yes| AddToFront[Broker: Add to front<br/>of queue]
    CheckForce -->|No| CheckRetry{Retry<br/>count > 0?}
    CheckRetry -->|Yes| AddToFront
    CheckRetry -->|No| AddToBack[Broker: Add to back<br/>of queue]
    AddToFront --> SendQueued
    AddToBack --> SendQueued[Broker: Send queued:<br/>acquired=false]
    SendQueued --> ClientQueued[Client: receive queued]
    ClientQueued --> WaitForNotify[Client: Wait for notification]
    WaitForNotify --> BrokerNotify[Broker: notify next<br/>in queue when lock released]
    BrokerNotify --> CheckCount
```

## Release Lock Flow

```mermaid
flowchart TD
    Start([Client: Release Lock]) --> ParseOpts[Client: Parse unlock options]
    ParseOpts --> SendUnlock[Client sends unlock request<br/>to broker]
    
    SendUnlock --> BrokerReceive[Broker: receive unlock request]
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    
    CheckLockExists -->|No| SendWarning[Broker: Send warning,<br/>unlocked=true]
    SendWarning --> ClientDone1[Client: Unlock complete<br/>with warning]
    
    CheckLockExists -->|Yes| CheckAuth{UUID matches<br/>or force=true?}
    CheckAuth -->|No| SendError[Broker: Send error,<br/>unlocked=false]
    SendError --> ClientError[Client: Unlock failed]
    
    CheckAuth -->|Yes| RemoveHolder[Broker: Remove client<br/>from lockholders]
    RemoveHolder --> ClearTTL[Broker: Clear TTL timer<br/>if exists]
    ClearTTL --> CheckQueue{Queue has<br/>waiting clients?}
    
    CheckQueue -->|Yes| NotifyNext[Broker: Notify next client<br/>in queue]
    NotifyNext --> GrantLock[Broker: Grant lock to<br/>next client]
    GrantLock --> SendSuccess1[Broker: Send success:<br/>acquired=true to next client]
    SendSuccess1 --> SendUnlockSuccess[Broker: Send success:<br/>unlocked=true to releasing client]
    SendUnlockSuccess --> ClientDone2[Client: Unlock complete]
    
    CheckQueue -->|No| MarkEmptied[Broker: Mark lock as emptied]
    MarkEmptied --> SendUnlockSuccess2[Broker: Send success:<br/>unlocked=true]
    SendUnlockSuccess2 --> ClientDone3[Client: Unlock complete]
```

