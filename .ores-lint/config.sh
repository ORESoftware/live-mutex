#!/bin/sh
# ores-lint shared configuration. Sourced by lint.sh, js.sh and rust.sh.
# Every value can be overridden from the environment, or per repo in local.sh.

# Maximum number of concrete example locations shown for any one rule.
: "${ORES_LINT_MAX_EXAMPLES:=5}"

# Warn-only by default: lint.sh exits 0 no matter what it finds.
# Flip to 1 (per repo, or in CI) once a repo's debt is paid down.
: "${ORES_LINT_STRICT:=0}"

: "${ORES_LINT_SKIP_RUST:=0}"
: "${ORES_LINT_SKIP_JS:=0}"
: "${ORES_LINT_SKIP_DART:=0}"
: "${ORES_LINT_SKIP_GLEAM:=0}"
: "${ORES_LINT_SKIP_REQUIRE_SEND:=0}"
: "${ORES_LINT_REQUIRE_SEND_INCLUDE_TESTS:=0}"

# How deep to search for nested sub-projects (crates and packages). Repos here
# routinely hold crates under apps/ and clients/ that a root-only lint misses.
: "${ORES_LINT_DEPTH:=5}"

# Include tests/benches/examples in the Rust pass. Off by default so the
# pre-publish signal is about shipped code.
: "${ORES_LINT_RUST_ALL_TARGETS:=0}"

# Minimum ESLint major version. Flat config needs 9+. ESLint is expected to be
# installed GLOBALLY, once - see required-tools.json. Nothing is ever installed
# into a repo's node_modules.
: "${ORES_LINT_ESLINT_MIN_MAJOR:=9}"

# The exact clippy diagnostic text for `clippy::implicit_return`. selftest.sh
# verifies this still matches, so a future clippy rewording surfaces as a test
# failure rather than as a silently empty report.
: "${ORES_LINT_IMPLICIT_RETURN_MSG:=missing \`return\` statement}"

export ORES_LINT_MAX_EXAMPLES ORES_LINT_STRICT ORES_LINT_SKIP_RUST ORES_LINT_SKIP_JS
export ORES_LINT_SKIP_DART ORES_LINT_SKIP_GLEAM ORES_LINT_SKIP_REQUIRE_SEND
export ORES_LINT_REQUIRE_SEND_INCLUDE_TESTS
export ORES_LINT_DEPTH ORES_LINT_RUST_ALL_TARGETS ORES_LINT_ESLINT_MIN_MAJOR
export ORES_LINT_IMPLICIT_RETURN_MSG

# Repo-local overrides, never overwritten by the rollout script. Sourced last so
# anything set here wins.
ORES_LINT_CFG_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
[ -f "$ORES_LINT_CFG_DIR/local.sh" ] && . "$ORES_LINT_CFG_DIR/local.sh"
