# End-to-end smoke test for the PowerShell client, mirroring clients/shell/smoke.sh.
#
#   pwsh ./smoke.ps1
#
# Override the broker endpoint via LMX_HOST / LMX_PORT (defaults 127.0.0.1:6970,
# the Broker1 default).

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'LiveMutexClient.ps1')

$lmxHost = if ($env:LMX_HOST) { $env:LMX_HOST } else { '127.0.0.1' }
$port = if ($env:LMX_PORT) { [int]$env:LMX_PORT } else { 6970 }

$c = [LiveMutexClient]::Connect($lmxHost, $port)
Write-Host "[smoke-powershell] connected ${lmxHost}:${port}"
try {
    $g1 = $c.Acquire('ps-smoke', 5000)
    Write-Host "[smoke-powershell] acquire #1: handle=$($g1.LockUuid) fencingToken=$($g1.FencingToken)"
    $c.Release('ps-smoke', $g1.LockUuid)

    $g2 = $c.Acquire('ps-smoke', 5000)
    Write-Host "[smoke-powershell] acquire #2: handle=$($g2.LockUuid) fencingToken=$($g2.FencingToken)"
    $c.Release('ps-smoke', $g2.LockUuid)

    if (-not ($g2.FencingToken -gt $g1.FencingToken)) {
        throw "fencing tokens must be strictly monotonic per key ($($g1.FencingToken) -> $($g2.FencingToken))"
    }
    Write-Host "[smoke-powershell] fencing tokens are strictly monotonic ($($g1.FencingToken) -> $($g2.FencingToken))"

    $many = $c.AcquireMany(@('ps-many-a', 'ps-many-b', 'ps-many-c'), 5000)
    Write-Host "[smoke-powershell] acquire_many: lockUuid=$($many.LockUuid) tokens=$($many.FencingTokens | ConvertTo-Json -Compress)"
    $c.ReleaseMany($many.LockUuid)
    Write-Host '[smoke-powershell] released composite'

    Write-Host '[smoke-powershell] OK'
}
finally {
    $c.Disconnect()
}
