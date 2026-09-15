#!/bin/sh
# ores-lint :: JavaScript / TypeScript
#
# ESLint is treated as a GLOBALLY INSTALLED TOOL, not a per-repo dependency.
# Nothing here installs anything and nothing reaches the network; hundreds of
# repos sharing one global eslint is the whole point. Resolution order:
#
#   1. a local node_modules/.bin/eslint, walking up for monorepos
#      (respected if a repo genuinely pins its own)
#   2. eslint on PATH  (npm i -g eslint)
#   3. the global npm root
#
# If none is found this prints an actionable skip and exits 0.

set -u
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIR/config.sh"
ROOT=${1:-.}

[ "${ORES_LINT_SKIP_JS}" = "1" ] && { echo "ores-lint[js]: skipped (ORES_LINT_SKIP_JS=1)"; exit 0; }

find_local_eslint() {
  d=$(CDPATH= cd -- "$1" && pwd)
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    if [ -x "$d/node_modules/.bin/eslint" ]; then printf '%s\n' "$d/node_modules/.bin/eslint"; return 0; fi
    d=$(dirname "$d")
  done
  return 1
}

GLOBAL_ROOT=""
for probe in "npm root -g" "pnpm root -g" "yarn global dir"; do
  r=$($probe 2>/dev/null | head -1)
  [ -n "$r" ] && [ -d "$r" ] && { GLOBAL_ROOT="$r"; break; }
done

ESLINT=""
ESLINT_KIND=""
if ESLINT=$(find_local_eslint "$ROOT"); then
  ESLINT_KIND="local"
elif command -v eslint >/dev/null 2>&1; then
  ESLINT=$(command -v eslint); ESLINT_KIND="global (PATH)"
elif [ -n "$GLOBAL_ROOT" ] && [ -x "$GLOBAL_ROOT/.bin/eslint" ]; then
  ESLINT="$GLOBAL_ROOT/.bin/eslint"; ESLINT_KIND="global"
else
  echo "ores-lint[js]: no eslint found - skipping"
  echo "               install it once, globally:  npm i -g eslint"
  echo "               (ores-lint never adds eslint to a repo's node_modules)"
  exit 0
fi

# Version gate. Flat config needs ESLint 9+; an older one would fail confusingly.
VER=$("$ESLINT" --version 2>/dev/null | sed 's/^v//')
MAJOR=$(printf '%s' "$VER" | cut -d. -f1)
case "$MAJOR" in
  ''|*[!0-9]*) : ;;  # unparseable version: proceed rather than block
  *)
    if [ "$MAJOR" -lt "${ORES_LINT_ESLINT_MIN_MAJOR}" ]; then
      echo "ores-lint[js]: found eslint $VER ($ESLINT_KIND) but flat config needs >=${ORES_LINT_ESLINT_MIN_MAJOR} - skipping"
      echo "               upgrade with:  npm i -g eslint@latest"
      exit 0
    fi
    ;;
esac

CONFIG=""
for c in eslint.config.mjs eslint.config.js eslint.config.cjs; do
  [ -f "$ROOT/$c" ] && { CONFIG="$ROOT/$c"; break; }
done
[ -z "$CONFIG" ] && { echo "ores-lint[js]: no flat eslint config found - skipping"; exit 0; }

# Let base.mjs find globally installed optional tooling (typescript-eslint).
[ -n "$GLOBAL_ROOT" ] && export ORES_LINT_GLOBAL_ROOT="$GLOBAL_ROOT"
[ -n "$GLOBAL_ROOT" ] && export NODE_PATH="${NODE_PATH:+$NODE_PATH:}$GLOBAL_ROOT"

# Make the TypeScript gap visible. A repo with a tsconfig whose .ts files are
# being skipped looks identical to a clean repo otherwise.
if [ -f "$ROOT/tsconfig.json" ] || ls "$ROOT"/src/*.ts >/dev/null 2>&1; then
  if ! node -e "
    const {createRequire}=require('node:module');
    const r=createRequire('$ROOT/package.json');
    const paths=[process.env.ORES_LINT_GLOBAL_ROOT].filter(Boolean);
    for (const id of ['typescript-eslint','@typescript-eslint/parser']) {
      try { r.resolve(id); process.exit(0); } catch {}
      if (paths.length) { try { r.resolve(id,{paths}); process.exit(0); } catch {} }
    }
    process.exit(1);
  " 2>/dev/null; then
    echo "ores-lint[js]: NOTE - this repo has TypeScript but no typescript-eslint parser;"
    echo "               .ts/.tsx files are being SKIPPED. Fix with: npm i -g typescript-eslint"
  fi
fi

OUT=$(mktemp) || exit 0
RC=0
( cd "$ROOT" && "$ESLINT" . \
    --no-error-on-unmatched-pattern \
    --format "$DIR/eslint/formatter.mjs" ) >"$OUT" 2>&1 || RC=$?

if [ "$RC" -ne 0 ] && ! grep -q 'ores-lint\[js\]' "$OUT"; then
  echo "ores-lint[js]: eslint $VER ($ESLINT_KIND) could not run in $ROOT (exit $RC). First lines:"
  sed -n '1,6p' "$OUT" | sed 's/^/  | /'
  rm -f "$OUT"; exit 0
fi

cat "$OUT"
rm -f "$OUT"
exit 0
