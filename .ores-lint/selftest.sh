#!/bin/sh
# ores-lint :: self-test
#
# Guards the two assumptions this toolkit rests on:
#   1. clippy still words `implicit_return` the way config.sh expects, and
#      `needless_return` can still be silenced (otherwise the two lints fight).
#   2. the vendored ESLint plugin still loads and its rules still fire.
#
# Run after a toolchain upgrade. Exits non-zero if an assumption has broken -
# a silently empty lint report is far worse than a failing test.

set -u
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIR/config.sh"
FAIL=0
pass() { echo "  ok   - $1"; }
fail() { echo "  FAIL - $1"; FAIL=1; }

echo "ores-lint self-test"

# --- Rust -------------------------------------------------------------------
if command -v cargo >/dev/null 2>&1 && cargo clippy --version >/dev/null 2>&1; then
  T=$(mktemp -d)
  mkdir -p "$T/src"
  cat > "$T/Cargo.toml" <<'EOF'
[package]
name = "ores_lint_selftest"
version = "0.0.0"
edition = "2021"
EOF
  cat > "$T/src/lib.rs" <<'EOF'
pub fn implicit(x: i32) -> i32 { x }
pub fn explicit(x: i32) -> i32 { return x; }
EOF
  OUT=$( cd "$T" && cargo clippy --message-format=short -- \
      -W clippy::implicit_return -A clippy::needless_return 2>&1 )

  if printf '%s' "$OUT" | grep -qF "$ORES_LINT_IMPLICIT_RETURN_MSG"; then
    pass "clippy implicit_return message matches config.sh"
  else
    fail "clippy implicit_return wording changed - update ORES_LINT_IMPLICIT_RETURN_MSG in config.sh"
    printf '%s\n' "$OUT" | sed -n '1,4p' | sed 's/^/         /'
  fi

  if printf '%s' "$OUT" | grep -q 'unneeded `return`'; then
    fail "needless_return still fires despite -A; it contradicts the house style"
  else
    pass "needless_return correctly silenced"
  fi

  N=$(printf '%s\n' "$OUT" | grep -cF "$ORES_LINT_IMPLICIT_RETURN_MSG")
  [ "$N" = "1" ] && pass "exactly 1 implicit return detected in fixture" \
                 || fail "expected 1 implicit return in fixture, saw $N"
  rm -rf "$T"
else
  echo "  skip - cargo/clippy unavailable"
fi

# --- JavaScript -------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  if node --input-type=module -e "
    const p = await import('$DIR/eslint/plugin.mjs');
    const names = Object.keys(p.default.rules);
    if (!names.includes('require-send') || !names.includes('semi')) process.exit(3);
  " 2>/dev/null; then
    pass "vendored eslint plugin loads with both rules"
  else
    fail "vendored eslint plugin failed to load"
  fi

  if node "$DIR/require-send.test.mjs" >/dev/null 2>&1; then
    pass "require-send scanner fixtures"
  else
    fail "require-send scanner fixtures failed"
    node "$DIR/require-send.test.mjs" 2>&1 | sed -n '1,20p' | sed 's/^/         /'
  fi
else
  echo "  skip - node unavailable"
fi

# --- Dart -------------------------------------------------------------------
if command -v dart >/dev/null 2>&1 || command -v flutter >/dev/null 2>&1; then
  pass "dart/flutter available for analyzer pass"
else
  echo "  skip - dart/flutter unavailable (dart.sh will no-op)"
fi

# --- Gleam ------------------------------------------------------------------
if command -v gleam >/dev/null 2>&1; then
  pass "gleam available for format/check pass"
else
  echo "  skip - gleam unavailable (gleam.sh will no-op)"
fi

[ "$FAIL" = "0" ] && echo "self-test passed" || echo "self-test FAILED"
exit "$FAIL"
