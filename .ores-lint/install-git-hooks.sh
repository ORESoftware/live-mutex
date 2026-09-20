#!/bin/sh
# Optional: install a pre-push hook that runs ores-lint.
# Not installed automatically by the rollout - run this yourself per repo.
set -eu
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not a git repo" >&2; exit 1; }
HOOKS_PATH=$(git -C "$ROOT" config --get core.hooksPath 2>/dev/null || true)
case "$HOOKS_PATH" in
  "")
    GIT_DIR=$(git -C "$ROOT" rev-parse --absolute-git-dir)
    HOOK_DIR="$GIT_DIR/hooks"
    ;;
  /*)
    HOOK_DIR="$HOOKS_PATH"
    ;;
  ~/*)
    HOOK_DIR="$HOME/${HOOKS_PATH#~/}"
    ;;
  *)
    # Git runs ordinary client-side hooks from the worktree root, so a relative
    # core.hooksPath is resolved from the repository root.
    HOOK_DIR="$ROOT/$HOOKS_PATH"
    ;;
esac
mkdir -p "$HOOK_DIR"
HOOK="$HOOK_DIR/pre-push"
if [ -e "$HOOK" ] && ! grep -q 'installed by .ores-lint/install-git-hooks.sh' "$HOOK"; then
  echo "refusing to clobber an existing pre-push hook: $HOOK" >&2
  exit 1
fi
cat > "$HOOK" <<'INNER'
#!/bin/sh
# installed by .ores-lint/install-git-hooks.sh
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 1
LINT="$ROOT/.ores-lint/lint.sh"
if [ ! -x "$LINT" ]; then
  echo "ores-lint pre-push: missing executable $LINT" >&2
  exit 1
fi
exec sh "$LINT"
INNER
chmod +x "$HOOK"
echo "installed $HOOK"
