#!/usr/bin/env bash
# End-to-end smoke test for the Bash client, mirroring clients/python3 / the
# cross-runtime smokes: acquire/release with a strictly-monotonic fencing token,
# then an atomic acquire-many / release-many.
#
#   ./smoke.sh
#
# Override the broker endpoint via LMX_HOST / LMX_PORT (defaults 127.0.0.1:6970,
# the Broker1 default). Start a Broker1 first, e.g.:
#   node -e "const {Broker1}=require('./dist/main'); new Broker1({port:6970,host:'127.0.0.1'}).ensure().then(()=>console.log('up'))"

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=live_mutex_client.sh
. "$HERE/live_mutex_client.sh"

HOST="${LMX_HOST:-127.0.0.1}"
PORT="${LMX_PORT:-6970}"

lmx_connect "$HOST" "$PORT"
echo "[smoke-shell] connected ${HOST}:${PORT}"
trap lmx_disconnect EXIT

lmx_acquire "shell-smoke" 5000
first="$LMX_FENCE"
echo "[smoke-shell] acquire #1: handle=${LMX_LOCK_UUID} fencingToken=${first}"
lmx_release "shell-smoke" "$LMX_LOCK_UUID"

lmx_acquire "shell-smoke" 5000
second="$LMX_FENCE"
echo "[smoke-shell] acquire #2: handle=${LMX_LOCK_UUID} fencingToken=${second}"
lmx_release "shell-smoke" "$LMX_LOCK_UUID"

# Broker1 emits monotonic fencing tokens; the legacy Broker omits them entirely
# (PROTOCOL: treat an absent token as 0/unknown). Assert monotonicity only when
# the broker actually returned tokens.
if [ -n "$first" ] && [ -n "$second" ]; then
  if ! [ "$second" -gt "$first" ] 2>/dev/null; then
    echo "[smoke-shell] FAIL: fencing tokens must be strictly monotonic per key ($first -> $second)" >&2
    exit 1
  fi
  echo "[smoke-shell] fencing tokens are strictly monotonic ($first -> $second)"
  is_broker1=1
else
  echo "[smoke-shell] broker emitted no fencing tokens (legacy Broker); skipping monotonic check"
  is_broker1=0
fi

# acquire-many is a Broker1 feature; the legacy Broker has no handler for it.
if [ "$is_broker1" = 1 ]; then
  lmx_acquire_many 5000 -- shell-many-a shell-many-b shell-many-c
  echo "[smoke-shell] acquire_many: lockUuid=${LMX_LOCK_UUID} tokens=${LMX_FENCES}"
  lmx_release_many "$LMX_LOCK_UUID"
  echo "[smoke-shell] released composite"
else
  echo "[smoke-shell] skipping acquire-many (unsupported by the legacy Broker)"
fi

echo "[smoke-shell] OK"
