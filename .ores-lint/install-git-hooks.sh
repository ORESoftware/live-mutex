#!/bin/sh
# Optional: install a pre-push hook that runs ores-lint.
# Not installed automatically by the rollout - run this yourself per repo.
set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not a git repo"; exit 1; }
HOOK="$ROOT/.git/hooks/pre-push"
if [ -e "$HOOK" ] && ! grep -q 'ores-lint' "$HOOK"; then
  echo "refusing to clobber an existing pre-push hook: $HOOK"
  exit 1
fi
cat > "$HOOK" <<'INNER'
#!/bin/sh
# installed by .ores-lint/install-git-hooks.sh
[ -x "$(git rev-parse --show-toplevel)/.ores-lint/lint.sh" ] && \
  sh "$(git rev-parse --show-toplevel)/.ores-lint/lint.sh"
exit 0
INNER
chmod +x "$HOOK"
echo "installed $HOOK"
