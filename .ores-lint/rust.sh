#!/bin/sh
# ores-lint :: Rust
#
# Discovers every crate in the repo - not just one at the root - runs clippy on
# each, and aggregates ALL of them into a single report so the example cap
# applies per repo rather than per crate.
#
# Workspace handling: after linting a crate root, `cargo metadata --no-deps`
# tells us exactly which manifests that invocation already covered, so workspace
# members are not linted twice while genuinely independent nested crates still
# get their own run.
#
# The headline custom behaviour: `clippy::implicit_return` fires once per
# implicit return, which across a repo means hundreds of identical warnings. The
# lint stays enabled so nothing is missed, but it is reported as ONE warning
# carrying at most ORES_LINT_MAX_EXAMPLES locations plus a total count.
#
# Critical interaction, handled below: `clippy::needless_return` ships enabled
# in clippy's default `style` group and warns on exactly the explicit returns
# this house style asks for. Enabling implicit_return without allowing
# needless_return makes the two lints contradict each other on every function.

set -u
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIR/config.sh"
ROOT=${1:-.}
ROOT=$(CDPATH= cd -- "$ROOT" && pwd)

[ "${ORES_LINT_SKIP_RUST}" = "1" ] && { echo "ores-lint[rust]: skipped (ORES_LINT_SKIP_RUST=1)"; exit 0; }
command -v cargo >/dev/null 2>&1 || { echo "ores-lint[rust]: cargo not found on PATH - skipping"; exit 0; }
cargo clippy --version >/dev/null 2>&1 || { echo "ores-lint[rust]: clippy not installed (rustup component add clippy) - skipping"; exit 0; }

LINTS="
-W clippy::implicit_return
-A clippy::needless_return
-A clippy::let_and_return
-W clippy::correctness
-W clippy::suspicious
-W clippy::await_holding_lock
-W clippy::unwrap_used
-W clippy::expect_used
-W clippy::panic_in_result_fn
-W clippy::todo
-W clippy::unimplemented
-W clippy::dbg_macro
-W clippy::mem_forget
-W clippy::float_cmp
-W clippy::lossy_float_literal
"
[ -n "${ORES_LINT_RUST_EXTRA:-}" ] && LINTS="$LINTS $ORES_LINT_RUST_EXTRA"
TARGETS=""
[ "${ORES_LINT_RUST_ALL_TARGETS}" = "1" ] && TARGETS="--all-targets"

# --- discover crates --------------------------------------------------------
CRATES=$(cd "$ROOT" && find . -maxdepth "${ORES_LINT_DEPTH}" \
    \( -name node_modules -o -name target -o -name .git -o -name dist -o -name build \
       -o -name vendor -o -name .vendor -o -name .worktrees -o -name _to_delete \
       -o -name .ores-lint \) -prune -o \
    -type f -name Cargo.toml -print 2>/dev/null \
  | sed 's|^\./||; s|Cargo\.toml$||; s|/$||; s|^$|.|' | sort)

[ -z "$CRATES" ] && { echo "ores-lint[rust]: no Cargo.toml found - nothing to do"; exit 0; }

# Drop crates that live inside a NESTED git repository. Those belong to a
# different repo with its own ores-lint install; linting them from here would
# report the same findings twice under the wrong repo name.
NESTED_FILE="$DIR/nested-repos.json"
if [ -f "$NESTED_FILE" ]; then
  NESTED=$(grep -o '"[^"]*"' "$NESTED_FILE" 2>/dev/null | tr -d '"')
  if [ -n "$NESTED" ]; then
    KEPT=""
    for c in $CRATES; do
      drop=0
      for nrepo in $NESTED; do
        case "$c" in
          "$nrepo"|"$nrepo"/*) drop=1; break ;;
        esac
      done
      [ "$drop" = "0" ] && KEPT="$KEPT
$c"
    done
    CRATES=$(printf '%s' "$KEPT" | sed '/^$/d')
  fi
fi

[ -z "$CRATES" ] && { echo "ores-lint[rust]: all crates belong to nested repos - nothing to do here"; exit 0; }

RAW=$(mktemp) || exit 0
COVERED=$(mktemp) || exit 0
RAN=0
SKIPPED_MEMBERS=0
FAILED=""

for c in $CRATES; do
  if [ "$c" = "." ]; then cdir="$ROOT"; else cdir="$ROOT/$c"; fi
  # Already covered by an earlier workspace invocation?
  if [ -s "$COVERED" ] && grep -qxF "$cdir" "$COVERED"; then
    SKIPPED_MEMBERS=$((SKIPPED_MEMBERS + 1))
    continue
  fi

  RC=0
  OUT=$(mktemp)
  # shellcheck disable=SC2086
  ( cd "$cdir" && cargo clippy --workspace $TARGETS --message-format=short -- $LINTS ) >"$OUT" 2>&1 || RC=$?

  if [ "$RC" -ne 0 ] && ! grep -q ': warning: \|: error: ' "$OUT"; then
    FAILED="$FAILED
  $c (exit $RC): $(sed -n '1,2p' "$OUT" | tr '\n' ' ' | cut -c1-140)"
    rm -f "$OUT"
    continue
  fi
  RAN=$((RAN + 1))

  # Re-root diagnostic paths at the repo, so a repo-wide report stays navigable.
  if [ "$c" = "." ]; then
    cat "$OUT" >> "$RAW"
  else
    sed "s|^|$c/|" "$OUT" >> "$RAW"
  fi
  rm -f "$OUT"

  # Record which manifests this invocation covered (workspace members).
  ( cd "$cdir" && cargo metadata --no-deps --offline --format-version 1 2>/dev/null ) \
    | grep -o '"manifest_path":"[^"]*"' \
    | sed 's/"manifest_path":"//; s/"$//; s|/Cargo\.toml$||' >> "$COVERED" 2>/dev/null || true
done

echo "ores-lint[rust]: linted $RAN crate root(s)$([ "$SKIPPED_MEMBERS" -gt 0 ] && echo ", $SKIPPED_MEMBERS workspace member(s) already covered")"
[ -n "$FAILED" ] && printf 'ores-lint[rust]: clippy could not run in some crates:%s\n' "$FAILED"

awk -v MAXEX="$ORES_LINT_MAX_EXAMPLES" -v TARGETMSG="$ORES_LINT_IMPLICIT_RETURN_MSG" '
BEGIN { max = MAXEX + 0; if (max < 1) max = 1; n = 0 }
match($0, /: (warning|error): /) {
  loc  = substr($0, 1, RSTART - 1)
  rest = substr($0, RSTART + 2)
  ci   = index(rest, ": ")
  sev  = substr(rest, 1, ci - 1)
  msg  = substr(rest, ci + 2)
  key  = loc "|" msg
  if (key in seen) next            # same finding reported by two crate runs
  seen[key] = 1
  if (!(msg in count)) { order[++n] = msg; sev_of[msg] = sev }
  count[msg]++
  if (shown[msg] < max) { ex[msg] = ex[msg] (shown[msg]++ ? "\n" : "") "      " loc }
  next
}
END {
  if (n == 0) { print "ores-lint[rust]: clean"; exit 0 }
  total = 0
  for (i = 1; i <= n; i++) total += count[order[i]]
  printf "ores-lint[rust]: %d finding(s) across %d rule(s)\n", total, n
  for (pass = 1; pass <= 2; pass++) {
    for (i = 1; i <= n; i++) {
      msg = order[i]
      is_target = (msg == TARGETMSG)
      if ((pass == 1) != is_target) continue
      label = is_target ? "implicit return (ores house style)" : msg
      printf "\n  %s: %s\n", sev_of[msg], label
      if (is_target) printf "    prefer an explicit `return` at tail position\n"
      printf "    %d instance(s); showing %d:\n", count[msg], (count[msg] < max ? count[msg] : max)
      print ex[msg]
      if (count[msg] > max) printf "      ... and %d more\n", count[msg] - max
    }
  }
  print ""
}
' "$RAW"

rm -f "$RAW" "$COVERED"
exit 0
