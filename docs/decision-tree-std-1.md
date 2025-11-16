# Standard Lock Decision Tree

This document shows the decision flow for how clients and the broker handle standard (non-reader-writer) lock acquisition and release.

## Acquire Lock Flow

```mermaid
flowchart TD
    Start[Client: acquire lock request] --> CheckConnection{Connection<br/>open?}
    CheckConnection -->|No| Error1[Return error:<br/>ConnectionClosed]
    CheckConnection -->|Yes| CheckRecovering{Connection<br/>recovering?}
    CheckRecovering -->|Yes| Error2[Return error:<br/>ConnectionRecovering]
    CheckRecovering -->|No| SendRequest[Send lock request<br/>to broker]
    
    SendRequest --> BrokerReceive[Broker: receive lock request]
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    
    CheckLockExists -->|No| CreateLock[Create new lock object]
    CreateLock --> AddHolder[Add client to lockholders]
    AddHolder --> SetTTL{TTL<br/>specified?}
    SetTTL -->|Yes| StartTimer[Start TTL timer]
    SetTTL -->|No| SendSuccess
    StartTimer --> SendSuccess[Send success:<br/>acquired=true]
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> ReturnUnlock[Return unlock function]
    
    CheckLockExists -->|Yes| CheckCount{Current holders<br/>< max?}
    CheckCount -->|Yes| AddHolder
    CheckCount -->|No| CheckForce{Force<br/>option?}
    CheckForce -->|Yes| AddToFront[Add to front<br/>of queue]
    CheckForce -->|No| CheckRetry{Retry<br/>count > 0?}
    CheckRetry -->|Yes| AddToFront
    CheckRetry -->|No| AddToBack[Add to back<br/>of queue]
    AddToFront --> SendQueued
    AddToBack --> SendQueued[Send queued:<br/>acquired=false]
    SendQueued --> ClientQueued[Client: receive queued]
    ClientQueued --> WaitForNotify[Wait for notification]
    WaitForNotify --> BrokerNotify[Broker: notify next<br/>in queue]
    BrokerNotify --> CheckCount
    
    ReturnUnlock --> End[Lock acquired]
```

## Release Lock Flow

```mermaid
flowchart TD
    Start[Client: release lock request] --> ParseOpts[Parse unlock options]
    ParseOpts --> SendRequest[Send unlock request<br/>to broker]
    
    SendRequest --> BrokerReceive[Broker: receive unlock request]
    BrokerReceive --> CheckLockExists{Lock exists<br/>for key?}
    CheckLockExists -->|No| Error1[Return error:<br/>Lock not found]
    
    CheckLockExists -->|Yes| CheckAuth{Valid UUID<br/>or force?}
    CheckAuth -->|No| Error2[Return error:<br/>Unauthorized]
    CheckAuth -->|Yes| RemoveHolder[Remove client<br/>from lockholders]
    RemoveHolder --> ClearTTL[Clear TTL timer]
    ClearTTL --> CheckQueue{Queue has<br/>waiting clients?}
    
    CheckQueue -->|Yes| NotifyNext[Notify next client<br/>in queue]
    NotifyNext --> GrantLock[Grant lock to<br/>next client]
    GrantLock --> SendSuccess
    CheckQueue -->|No| SendSuccess[Send success:<br/>unlocked=true]
    
    SendSuccess --> ClientSuccess[Client: receive success]
    ClientSuccess --> End[Lock released]
```

