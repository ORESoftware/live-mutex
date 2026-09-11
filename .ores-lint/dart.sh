#!/bin/sh
# ores-lint :: Dart / Flutter
#
# Uses the Dart analyzer (`dart analyze` / `flutter analyze`) - the universally
# accepted linter for the language, equivalent to ESLint for TypeScript. Custom
# house rules that the analyzer cannot express (require-send) live in
# require-send.mjs and run from lint.sh.
#
# Nothing is installed. Missing dart/flutter is an actionable skip.

set -u
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$DIR/config.sh"
ROOT=${1:-.}
ROOT=$(CDPATH= cd -- "$ROOT" && pwd)

[ "${ORES_LINT_SKIP_DART}" = "1" ] && { echo "ores-lint[dart]: skipped (ORES_LINT_SKIP_DART=1)"; exit 0; }

has_dart=0
if find "$ROOT" -maxdepth "$ORES_LINT_DEPTH" \
     \( -name node_modules -o -name target -o -name .git -o -name vendor -o -name .vendor -o -name build \) -prune -o \
     \( -type f -name pubspec.yaml -o -type f -name '*.dart' \) -print 2>/dev/null | head -1 | grep -q .; then
  has_dart=1
fi
[ "$has_dart" = "0" ] && exit 0

ANALYZE=""
if command -v dart >/dev/null 2>&1; then
  ANALYZE="dart analyze"
elif command -v flutter >/dev/null 2>&1; then
  ANALYZE="flutter analyze"
else
  echo "ores-lint[dart]: dart/flutter not found on PATH - skipping"
  echo "               install the Dart SDK, or Flutter, then re-run"
  exit 0
fi

# Nested git repos are someone else's analyzer run.
NESTED_FILE="$DIR/nested-repos.json"
EXCLUDE=""
if [ -f "$NESTED_FILE" ]; then
  NESTED=$(grep -o '"[^"]*"' "$NESTED_FILE" 2>/dev/null | tr -d '"')
  for nrepo in $NESTED; do
    [ -n "$nrepo" ] && EXCLUDE="$EXCLUDE --fatal-infos=false"
  done
fi

OUT=$(mktemp) || exit 0
RC=0
( cd "$ROOT" && $ANALYZE --format=machine 2>/dev/null || $ANALYZE ) >"$OUT" 2>&1 || RC=$?

if grep -q 'No issues found!' "$OUT"; then
  echo "ores-lint[dart]: clean"
  rm -f "$OUT"
  exit 0
fi

if [ "$RC" -ne 0 ] && ! grep -qE 'error|warning|info|ERROR|WARNING' "$OUT"; then
  echo "ores-lint[dart]: analyzer could not run in $ROOT (exit $RC). First lines:"
  sed -n '1,6p' "$OUT" | sed 's/^/  | /'
  rm -f "$OUT"
  exit 0
fi

awk -v MAXEX="$ORES_LINT_MAX_EXAMPLES" '
BEGIN { max = MAXEX + 0; if (max < 1) max = 1; n = 0; FS = "|" }
# machine format: SEVERITY|TYPE|FILE|LINE|COLUMN|LENGTH|CODE|MESSAGE
NF >= 8 && $1 ~ /^(ERROR|WARNING|INFO)$/ {
  loc = $3 ":" $4 ":" $5
  msg = $7 ": " $8
  sev = tolower($1)
  if (sev == "info") sev = "warning"
  key = loc "|" msg
  if (key in seen) next
  seen[key] = 1
  if (!(msg in count)) { order[++n] = msg; sev_of[msg] = sev }
  count[msg]++
  if (shown[msg] < max) { ex[msg] = ex[msg] (shown[msg]++ ? "\n" : "") "      " loc }
  next
}
# human format fallback: "  warning - path:line:col - message - code"
{
  line = $0
  if (match(line, /(error|warning|info) • /) || match(line, /(error|warning|info) - /)) {
    n++
    raw[++human] = line
  }
}
END {
  if (n == 0 && human == 0) { print "ores-lint[dart]: clean"; exit 0 }
  if (n == 0) {
    printf "ores-lint[dart]: %d finding(s)\n", human
    limit = (human < max ? human : max)
    for (i = 1; i <= limit; i++) print "      " raw[i]
    if (human > max) printf "      ... and %d more\n", human - max
    print ""
    exit 0
  }
  total = 0
  for (i = 1; i <= n; i++) total += count[order[i]]
  printf "ores-lint[dart]: %d finding(s) across %d rule(s)\n", total, n
  for (i = 1; i <= n; i++) {
    msg = order[i]
    printf "\n  %s: %s\n", sev_of[msg], msg
    printf "    %d instance(s); showing %d:\n", count[msg], (count[msg] < max ? count[msg] : max)
    print ex[msg]
    if (count[msg] > max) printf "      ... and %d more\n", count[msg] - max
  }
  print ""
}
' "$OUT"

rm -f "$OUT"
exit 0
