#!/bin/sh
# ores-lint :: Gleam
#
# Uses the Gleam compiler toolchain - the universally accepted checker for the
# language (there is no ESLint-equivalent plugin host):
#   gleam format --check   formatting, analogous to rustfmt --check
#   gleam check            compiler warnings / unused values
# Custom house rules (require-send on logging pipes) live in require-send.mjs
# and run from lint.sh.
#
# Nothing is installed. Missing gleam is an actionable skip.

set -u
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIR/config.sh"
ROOT=${1:-.}
ROOT=$(CDPATH= cd -- "$ROOT" && pwd)

[ "${ORES_LINT_SKIP_GLEAM}" = "1" ] && { echo "ores-lint[gleam]: skipped (ORES_LINT_SKIP_GLEAM=1)"; exit 0; }

TOMLS=$(cd "$ROOT" && find . -maxdepth "$ORES_LINT_DEPTH" \
    \( -name node_modules -o -name target -o -name .git -o -name build -o -name vendor -o -name .vendor -o -name .ores-lint \) -prune -o \
    -type f -name gleam.toml -print 2>/dev/null \
  | sed 's|^\./||; s|gleam\.toml$||; s|/$||; s|^$|.|' | sort)

[ -z "$TOMLS" ] && exit 0

command -v gleam >/dev/null 2>&1 || {
  echo "ores-lint[gleam]: gleam not found on PATH - skipping"
  echo "               install from https://gleam.run/getting-started/installing/"
  exit 0
}

NESTED_FILE="$DIR/nested-repos.json"
if [ -f "$NESTED_FILE" ]; then
  NESTED=$(grep -o '"[^"]*"' "$NESTED_FILE" 2>/dev/null | tr -d '"')
  if [ -n "$NESTED" ]; then
    KEPT=""
    for c in $TOMLS; do
      drop=0
      for nrepo in $NESTED; do
        case "$c" in
          "$nrepo"|"$nrepo"/*) drop=1; break ;;
        esac
      done
      [ "$drop" = "0" ] && KEPT="$KEPT
$c"
    done
    TOMLS=$(printf '%s' "$KEPT" | sed '/^$/d')
  fi
fi

[ -z "$TOMLS" ] && { echo "ores-lint[gleam]: all packages belong to nested repos - nothing to do here"; exit 0; }

RAW=$(mktemp) || exit 0
RAN=0
FAILED=""

for c in $TOMLS; do
  if [ "$c" = "." ]; then cdir="$ROOT"; else cdir="$ROOT/$c"; fi
  OUT=$(mktemp)
  RC=0
  FMT_ARGS="src"
  [ -d "$cdir/test" ] && FMT_ARGS="$FMT_ARGS test"
  ( cd "$cdir" && gleam format --check $FMT_ARGS 2>/dev/null; gleam check ) >"$OUT" 2>&1 || RC=$?
  RAN=$((RAN + 1))
  if [ "$RC" -ne 0 ] && ! grep -qE 'error|warning|Which files to format' "$OUT"; then
    FAILED="$FAILED
  $c (exit $RC): $(sed -n '1,2p' "$OUT" | tr '\n' ' ' | cut -c1-140)"
    rm -f "$OUT"
    continue
  fi
  if [ "$c" = "." ]; then cat "$OUT" >> "$RAW"; else sed "s|^|$c/|" "$OUT" >> "$RAW"; fi
  rm -f "$OUT"
done

echo "ores-lint[gleam]: linted $RAN package(s)"
[ -n "$FAILED" ] && printf 'ores-lint[gleam]: gleam could not run in some packages:%s\n' "$FAILED"

awk -v MAXEX="$ORES_LINT_MAX_EXAMPLES" '
BEGIN { max = MAXEX + 0; if (max < 1) max = 1; n = 0 }
/error:|warning:/ {
  msg = $0
  n++
  if (shown < max) { ex = ex (shown++ ? "\n" : "") "      " msg; }
  next
}
END {
  if (n == 0) { print "ores-lint[gleam]: clean"; exit 0 }
  printf "ores-lint[gleam]: %d finding(s)\n", n
  print ex
  if (n > max) printf "      ... and %d more\n", n - max
  print ""
}
' "$RAW"

rm -f "$RAW"
exit 0
