# LiveMutexClient.ps1 — PowerShell client for the fencing-token-aware live-mutex
# broker (`Broker1`, src/broker-1.ts).
#
# The Windows-shell companion to clients/shell. Same newline-delimited JSON wire
# protocol over TCP (see clients/README.md), implemented with
# System.Net.Sockets.TcpClient and ConvertTo-Json / ConvertFrom-Json. Runs on
# Windows PowerShell 5.1 and PowerShell 7+ (pwsh) on macOS/Linux.
#
# Dot-source this file and use [LiveMutexClient]::Connect(host, port); see
# smoke.ps1 for an end-to-end example.

# StrictMode 1.0 still catches uninitialized variables but lets an absent JSON
# field read back as $null (the legacy Broker omits fencingToken; a bare error
# frame may omit `type`) instead of throwing.
Set-StrictMode -Version 1.0

# Wire `type` discriminators (mirror src/broker-1.ts) — named, not inlined.
$script:LmxReq = @{
    Version     = 'version'
    Lock        = 'lock'
    Unlock      = 'unlock'
    AcquireMany = 'acquire-many'
    ReleaseMany = 'release-many'
}
$script:LmxVersionMismatch = 'version-mismatch'

class LiveMutexClient {
    [System.Net.Sockets.TcpClient] $Tcp
    [System.IO.StreamReader] $Reader
    [System.IO.Stream] $Stream
    [int] $TimeoutMs = 30000
    # Client handshake version; forward-safe (broker only replies if we are too old).
    [string] $Version = '0.2.27'

    static [LiveMutexClient] Connect([string] $iHost, [int] $port) {
        $c = [LiveMutexClient]::new()
        $c.Tcp = [System.Net.Sockets.TcpClient]::new()
        $c.Tcp.NoDelay = $true
        $c.Tcp.Connect($iHost, $port)
        $c.Stream = $c.Tcp.GetStream()
        $c.Stream.ReadTimeout = $c.TimeoutMs
        $c.Reader = [System.IO.StreamReader]::new($c.Stream, [System.Text.Encoding]::UTF8)
        $c.Send(@{ type = $script:LmxReq.Version; value = $c.Version })  # fire-and-forget
        return $c
    }

    static [string] NewUuid() { return [guid]::NewGuid().ToString() }

    hidden [void] Send([hashtable] $frame) {
        $json = ($frame | ConvertTo-Json -Compress -Depth 6) + "`n"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        $this.Stream.Write($bytes, 0, $bytes.Length)
        $this.Stream.Flush()
    }

    # Read frames until one carries our uuid; return it parsed.
    hidden [object] ReadReply([string] $want) {
        while ($true) {
            $line = $this.Reader.ReadLine()
            if ($null -eq $line) { throw 'connection closed by broker' }
            if ($line -eq '') { continue }
            $obj = $line | ConvertFrom-Json
            if ($obj.type -eq $script:LmxVersionMismatch) { throw "version mismatch: $line" }
            if ($obj.uuid -eq $want) { return $obj }
        }
        throw 'unreachable'
    }

    # Blocks until granted. Broker1 enqueues on contention and replies
    # acquired:true on promotion (or acquired:false WITH an error on rejection).
    [pscustomobject] Acquire([string] $key, [int] $ttlMs) {
        $u = [LiveMutexClient]::NewUuid()
        $ttl = if ($ttlMs -gt 0) { $ttlMs } else { $null }
        $this.Send(@{ type = $script:LmxReq.Lock; uuid = $u; key = $key; pid = $PID; keepLocksAfterDeath = $false; ttl = $ttl })
        $r = $this.ReadReply($u)
        if ($r.acquired -ne $true) { throw "acquire($key) failed: $($r | ConvertTo-Json -Compress)" }
        # The single-key lock handle is the request uuid.
        return [pscustomobject]@{ Key = $key; LockUuid = $u; FencingToken = $r.fencingToken }
    }

    [void] Release([string] $key, [string] $lockUuid) {
        $u = [LiveMutexClient]::NewUuid()
        $this.Send(@{ type = $script:LmxReq.Unlock; uuid = $u; '_uuid' = $lockUuid; key = $key })
        $r = $this.ReadReply($u)
        if ($r.unlocked -ne $true) { throw "release($key) failed: $($r | ConvertTo-Json -Compress)" }
    }

    [pscustomobject] AcquireMany([string[]] $keys, [int] $ttlMs) {
        $u = [LiveMutexClient]::NewUuid()
        $ttl = if ($ttlMs -gt 0) { $ttlMs } else { $null }
        $this.Send(@{ type = $script:LmxReq.AcquireMany; uuid = $u; keys = $keys; ttl = $ttl })
        $r = $this.ReadReply($u)
        if ($r.acquired -ne $true) { throw "acquire_many failed: $($r | ConvertTo-Json -Compress)" }
        return [pscustomobject]@{ Keys = $keys; LockUuid = $r.lockUuid; FencingTokens = $r.fencingTokens }
    }

    [void] ReleaseMany([string] $lockUuid) {
        $u = [LiveMutexClient]::NewUuid()
        $this.Send(@{ type = $script:LmxReq.ReleaseMany; uuid = $u; lockUuid = $lockUuid })
        $r = $this.ReadReply($u)
        if ($r.released -ne $true) { throw "release_many failed: $($r | ConvertTo-Json -Compress)" }
    }

    [void] Disconnect() {
        if ($this.Reader) { $this.Reader.Dispose() }
        if ($this.Tcp) { $this.Tcp.Close() }
    }
}
