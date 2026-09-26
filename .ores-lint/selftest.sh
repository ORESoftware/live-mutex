#!/bin/sh
# ores-lint :: self-test
#
# Guards the assumptions this toolkit rests on:
#   1. the source-aware Rust checker flags implicit returns in named functions
#      without flagging concise closure/lambda tail expressions;
#   2. clippy::needless_return stays silenced so Clippy does not fight the
#      canonical ORE explicit-return rule;
#   3. the vendored ESLint plugin still loads and its rules still fire.
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
if command -v cargo >/dev/null 2>&1 && cargo clippy --version >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  T=$(mktemp -d)
  mkdir -p "$T/src"
  cat > "$T/Cargo.toml" <<'EOF'
[package]
name = "ores_lint_selftest"
version = "0.0.0"
edition = "2021"
EOF
  cat > "$T/src/lib.rs" <<'EOF'
pub fn implicit(x: i32) -> i32 {
    x
}

pub fn explicit(x: i32) -> i32 {
    return x;
}

pub fn closure_expression(values: &[i32]) -> i32 {
    return values.iter().map(|value| value * 2).sum();
}

pub fn closure_block(values: &[i32]) -> i32 {
    return values
        .iter()
        .map(|value| {
            let adjusted = value + 1;
            adjusted
        })
        .sum();
}

pub fn returned_closure() -> impl Fn(i32) -> i32 {
    |value| value + 1
}
EOF

  OUT=$(node "$DIR/rust-explicit-returns.mjs" "$T" 2>&1)
  N=$(printf '%s\n' "$OUT" | grep -cF "$ORES_LINT_IMPLICIT_RETURN_MSG" || true)

  if [ "$N" = "2" ]; then
    pass "named-function checker finds exactly 2 implicit returns"
  else
    fail "expected 2 named-function implicit returns, saw $N"
    printf '%s\n' "$OUT" | sed -n '1,12p' | sed 's/^/         /'
  fi

  if printf '%s\n' "$OUT" | grep -q 'closure_expression\|closure_block'; then
    fail "closure tails were incorrectly reported as named-function implicit returns"
  else
    pass "closure tails remain concise and unreported"
  fi

  CLIPPY_OUT=$( cd "$T" && cargo clippy --message-format=short -- -A clippy::needless_return 2>&1 )
  if printf '%s' "$CLIPPY_OUT" | grep -q 'unneeded `return`'; then
    fail "needless_return still fires despite -A; it contradicts the house style"
  else
    pass "needless_return correctly silenced"
  fi

  rm -rf "$T"
else
  echo "  skip - cargo/clippy/node unavailable"
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
