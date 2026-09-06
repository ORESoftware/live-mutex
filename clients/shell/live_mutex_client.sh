#!/usr/bin/env bash
# live_mutex_client.sh — Bash client for the fencing-token-aware live-mutex
# broker (`Broker1`, src/broker-1.ts).
#
# Speaks the newline-delimited JSON wire protocol over TCP (see clients/README.md
# for the wire crib). The only dependency is bash itself (3.2+, with net
# redirections — the default on macOS and Linux): the transport is bash's
# built-in /dev/tcp, so there is no nc / python / jq dependency. zsh/sh users run
# the scripts directly; the shebang selects bash. Source this file and call the
# lmx_* functions — see smoke.sh for an end-to-end example.

# The wire constants and LMX_* result globals are this library's public API
# (callers reference them), so the "appears unused" (SC2034) heuristic is
# suppressed file-wide here.
# shellcheck disable=SC2034

# Wire `type` discriminators (mirror src/broker-1.ts) — named, not inlined.
readonly LMX_REQ_VERSION="version"
readonly LMX_REQ_LOCK="lock"
readonly LMX_REQ_UNLOCK="unlock"
readonly LMX_REQ_ACQUIRE_MANY="acquire-many"
readonly LMX_REQ_RELEASE_MANY="release-many"
readonly LMX_RES_VERSION_MISMATCH="version-mismatch"

# Client version sent on the (fire-and-forget) handshake. The broker only
# replies when the client is strictly older than it supports, so keeping this in
# step with package.json is forward-safe.
: "${LMX_VERSION:=0.2.27}"
: "${LMX_TIMEOUT:=30}"

LMX_REPLY=""        # last raw JSON frame received
LMX_ERROR=""        # last broker error string (when an op fails)
LMX_LOCK_UUID=""    # lock handle from the last successful acquire (== request uuid for single keys)
LMX_FENCE=""        # fencing token from the last single-key grant
LMX_FENCES=""       # raw fencingTokens object from the last acquire-many

lmx_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then uuidgen | tr '[:upper:]' '[:lower:]'
  elif [ -r /proc/sys/kernel/random/uuid ]; then cat /proc/sys/kernel/random/uuid
  else printf '%s-%s-%s-%s' "$RANDOM$RANDOM" "$RANDOM" "$$" "$(date +%s)"; fi
}

# Escape a value for safe embedding inside a JSON string literal (backslash,
# double-quote, and the common control characters), so a key like `a"b` cannot
# break the frame or forge extra fields.
lmx_json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

lmx_json_str() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }
lmx_json_num() { sed -n "s/.*\"$1\":\([0-9][0-9]*\).*/\1/p"; }
lmx_json_array() {
  local out="" k
  for k in "$@"; do out="$out,\"$(lmx_json_escape "$k")\""; done
  printf '[%s]' "${out:1}"
}

# lmx_connect <host> <port>  — opens the stream and sends the version handshake.
lmx_connect() {
  local host="${1:-127.0.0.1}" port="${2:-6970}"
  exec 3<>"/dev/tcp/${host}/${port}" || { LMX_ERROR="connect ${host}:${port} failed"; return 1; }
  _lmx_send "$(printf '{"type":"%s","value":"%s"}' "$LMX_REQ_VERSION" "$(lmx_json_escape "$LMX_VERSION")")"
}

lmx_disconnect() { exec 3>&- 2>/dev/null; exec 3<&- 2>/dev/null; return 0; }

_lmx_send() { printf '%s\n' "$1" >&3; }

# Read frames until one carries our uuid; stash it in LMX_REPLY.
_lmx_read_reply() {
  local want="$1" line
  while IFS= read -r -t "$LMX_TIMEOUT" line <&3; do
    [ -z "$line" ] && continue
    case "$line" in
      *"$LMX_RES_VERSION_MISMATCH"*) LMX_ERROR="version mismatch: $line"; return 1 ;;
    esac
    case "$line" in *"\"uuid\":\"$want\""*) LMX_REPLY="$line"; return 0 ;; esac
  done
  return 1
}

# lmx_acquire <key> [ttl_ms] [max]  -> blocks until granted; sets LMX_LOCK_UUID/LMX_FENCE.
# (Broker1 does not reply on contention — it enqueues and replies acquired:true
#  on promotion, or acquired:false WITH an error on hard rejection.)
lmx_acquire() {
  local key="$1" ttl="${2:-null}" max="${3:-}" uuid; uuid="$(lmx_uuid)"
  local maxf=""; [ -n "$max" ] && maxf=",\"max\":$max"
  _lmx_send "$(printf '{"type":"%s","uuid":"%s","key":"%s","pid":%s,"keepLocksAfterDeath":false,"ttl":%s%s}' \
    "$LMX_REQ_LOCK" "$uuid" "$(lmx_json_escape "$key")" "$$" "$ttl" "$maxf")"
  _lmx_read_reply "$uuid" || { LMX_ERROR="acquire($key): ${LMX_ERROR:-timeout}"; return 1; }
  case "$LMX_REPLY" in *'"acquired":true'*) ;; *) LMX_ERROR="acquire($key): $LMX_REPLY"; return 1 ;; esac
  LMX_LOCK_UUID="$uuid"   # single-key lock handle is the request uuid
  LMX_FENCE="$(lmx_json_num fencingToken <<<"$LMX_REPLY")"
}

# lmx_release <key> <lock_uuid> [force]
lmx_release() {
  local key="$1" lock="$2" force="${3:-}" uuid; uuid="$(lmx_uuid)"
  local forcef=""; [ -n "$force" ] && forcef=",\"force\":true"
  _lmx_send "$(printf '{"type":"%s","uuid":"%s","_uuid":"%s","key":"%s"%s}' \
    "$LMX_REQ_UNLOCK" "$uuid" "$(lmx_json_escape "$lock")" "$(lmx_json_escape "$key")" "$forcef")"
  _lmx_read_reply "$uuid" || { LMX_ERROR="release($key): timeout"; return 1; }
  case "$LMX_REPLY" in *'"unlocked":true'*) return 0 ;; *) LMX_ERROR="release($key): $LMX_REPLY"; return 1 ;; esac
}

# lmx_acquire_many [ttl_ms] -- <key>...  -> sets LMX_LOCK_UUID / LMX_FENCES (atomic union)
lmx_acquire_many() {
  local ttl="$1"; shift; [ "${1:-}" = "--" ] && shift
  local uuid; uuid="$(lmx_uuid)"
  _lmx_send "$(printf '{"type":"%s","uuid":"%s","keys":%s,"ttl":%s}' \
    "$LMX_REQ_ACQUIRE_MANY" "$uuid" "$(lmx_json_array "$@")" "$ttl")"
  _lmx_read_reply "$uuid" || { LMX_ERROR="acquire_many: ${LMX_ERROR:-timeout}"; return 1; }
  case "$LMX_REPLY" in *'"acquired":true'*) ;; *) LMX_ERROR="acquire_many: $LMX_REPLY"; return 1 ;; esac
  LMX_LOCK_UUID="$(lmx_json_str lockUuid <<<"$LMX_REPLY")"
  LMX_FENCES="$(sed -n 's/.*\("fencingTokens":{[^}]*}\).*/\1/p' <<<"$LMX_REPLY")"
}

# lmx_release_many <lock_uuid>
lmx_release_many() {
  local lock="$1" uuid; uuid="$(lmx_uuid)"
  _lmx_send "$(printf '{"type":"%s","uuid":"%s","lockUuid":"%s"}' \
    "$LMX_REQ_RELEASE_MANY" "$uuid" "$(lmx_json_escape "$lock")")"
  _lmx_read_reply "$uuid" || { LMX_ERROR="release_many: timeout"; return 1; }
  case "$LMX_REPLY" in *'"released":true'*) return 0 ;; *) LMX_ERROR="release_many: $LMX_REPLY"; return 1 ;; esac
}
