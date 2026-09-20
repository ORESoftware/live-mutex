#!/bin/sh
set -eu

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/ores-lint-hooks.XXXXXX")
trap 'rm -rf "$TMP_ROOT"' EXIT HUP INT TERM

new_repo() {
  name=$1
  repo="$TMP_ROOT/$name"
  mkdir -p "$repo/.ores-lint"
  git -C "$repo" init -q
  cp "$SOURCE_DIR/install-git-hooks.sh" "$repo/.ores-lint/install-git-hooks.sh"
  cat > "$repo/.ores-lint/lint.sh" <<'EOF'
#!/bin/sh
: > "$(git rev-parse --show-toplevel)/lint-ran"
EOF
  chmod +x "$repo/.ores-lint/install-git-hooks.sh" "$repo/.ores-lint/lint.sh"
  printf '%s\n' "$repo"
}

repo=$(new_repo default)
(
  cd "$repo"
  sh .ores-lint/install-git-hooks.sh
  git_dir=$(git rev-parse --absolute-git-dir)
  test -x "$git_dir/hooks/pre-push"
  "$git_dir/hooks/pre-push"
  test -f lint-ran
)

repo=$(new_repo relative)
(
  cd "$repo"
  git config core.hooksPath .githooks
  sh .ores-lint/install-git-hooks.sh
  test -x .githooks/pre-push
  .githooks/pre-push
  test -f lint-ran
  test ! -e "$(git rev-parse --absolute-git-dir)/hooks/pre-push"
)

repo=$(new_repo absolute)
absolute_hooks="$TMP_ROOT/absolute-hooks"
(
  cd "$repo"
  git config core.hooksPath "$absolute_hooks"
  sh .ores-lint/install-git-hooks.sh
  test -x "$absolute_hooks/pre-push"
)

repo=$(new_repo tilde)
mkdir -p "$TMP_ROOT/home"
(
  cd "$repo"
  HOME="$TMP_ROOT/home" git config core.hooksPath '~/custom-hooks'
  HOME="$TMP_ROOT/home" sh .ores-lint/install-git-hooks.sh
  test -x "$TMP_ROOT/home/custom-hooks/pre-push"
)

repo=$(new_repo conflict)
(
  cd "$repo"
  git config core.hooksPath .githooks
  mkdir -p .githooks
  printf '%s\n' '#!/bin/sh' 'echo existing' > .githooks/pre-push
  chmod +x .githooks/pre-push
  before=$(cat .githooks/pre-push)
  if sh .ores-lint/install-git-hooks.sh; then
    echo 'installer overwrote an unrelated pre-push hook' >&2
    exit 1
  fi
  test "$(cat .githooks/pre-push)" = "$before"
)

printf '%s\n' 'ores-lint Git hook installer contract: PASS'
