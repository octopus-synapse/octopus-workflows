#!/usr/bin/env bash
#
# pin-actions.sh — pin GitHub Actions references to full SHAs.
#
# Usage:
#   _tooling/pin-actions.sh [--dry-run|--apply] [path]
#
#   --dry-run   (default) print what would change, no files touched
#   --apply     rewrite files in place
#   path        directory or file glob root (default: .github/workflows)
#
# What it does:
#   For each `uses: <owner>/<repo>[/sub/path]@<ref>` line under PATH:
#     - if <ref> is already a 40-char hex SHA          -> skip
#     - if <ref> starts with `./` or `docker://`       -> skip (local / docker action)
#     - if <owner>/<repo> equals the current repo      -> skip (self-reference)
#     - otherwise resolve <ref> via
#         gh api repos/<owner>/<repo>/git/refs/tags/<ref>     (annotated tag)
#         gh api repos/<owner>/<repo>/git/refs/heads/<ref>    (branch fallback)
#         gh api repos/<owner>/<repo>/commits/<ref>           (last-resort)
#       and rewrite to `uses: <owner>/<repo>[/sub/path]@<sha> # <ref>`
#
# Idempotent: re-running on an already-pinned file is a no-op.
#
# Requires: bash 4+, gh (authenticated), grep, sed.

set -euo pipefail

MODE="dry-run"
TARGET=".github/workflows"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) MODE="dry-run"; shift ;;
    --apply)   MODE="apply";   shift ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) TARGET="$1"; shift ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI is required (https://cli.github.com/)" >&2
  exit 1
fi

# Self-reference detection: read the local repo's slug if we're inside a repo
# context. Falls back to empty string (no self-skip) on bare invocations.
SELF_SLUG=""
if git_origin=$(git config --get remote.origin.url 2>/dev/null); then
  SELF_SLUG=$(echo "$git_origin" \
    | sed -E 's#(https://github\.com/|git@github\.com:)##; s#\.git$##')
fi

# Cache resolved SHAs per `owner/repo@ref` so multiple references resolve once.
declare -A SHA_CACHE=()

resolve_sha() {
  local owner_repo="$1" ref="$2"
  local key="${owner_repo}@${ref}"
  if [[ -n "${SHA_CACHE[$key]:-}" ]]; then
    echo "${SHA_CACHE[$key]}"
    return 0
  fi

  local sha=""
  # Try tag ref first (most actions are tag-pinned in user code)
  sha=$(gh api "repos/${owner_repo}/git/refs/tags/${ref}" \
        --jq '.object.sha' 2>/dev/null || true)

  # Annotated tags point at a tag object — dereference one more hop.
  if [[ -n "$sha" ]]; then
    local kind
    kind=$(gh api "repos/${owner_repo}/git/refs/tags/${ref}" \
           --jq '.object.type' 2>/dev/null || true)
    if [[ "$kind" == "tag" ]]; then
      local deref
      deref=$(gh api "repos/${owner_repo}/git/tags/${sha}" \
              --jq '.object.sha' 2>/dev/null || true)
      [[ -n "$deref" ]] && sha="$deref"
    fi
  fi

  # Branch fallback
  if [[ -z "$sha" ]]; then
    sha=$(gh api "repos/${owner_repo}/git/refs/heads/${ref}" \
          --jq '.object.sha' 2>/dev/null || true)
  fi

  # Last-resort: try as a generic commit-ish
  if [[ -z "$sha" ]]; then
    sha=$(gh api "repos/${owner_repo}/commits/${ref}" \
          --jq '.sha' 2>/dev/null || true)
  fi

  if [[ -z "$sha" ]]; then
    return 1
  fi
  SHA_CACHE[$key]="$sha"
  echo "$sha"
}

is_sha() {
  [[ "$1" =~ ^[0-9a-f]{40}$ ]]
}

process_file() {
  local file="$1"
  local changed=0
  local tmp
  tmp=$(mktemp)

  # Match lines of the form `<lead>uses: <owner>/<repo>[/sub/path]@<ref>`
  # Optional trailing `# <comment>` is preserved/replaced with the ref name.
  while IFS= read -r line; do
    if [[ "$line" =~ ^([[:space:]]*-?[[:space:]]*uses:[[:space:]]+)([^@[:space:]]+)@([^[:space:]#]+)(.*)$ ]]; then
      local lead="${BASH_REMATCH[1]}"
      local action_path="${BASH_REMATCH[2]}"
      local ref="${BASH_REMATCH[3]}"
      local trailing="${BASH_REMATCH[4]}"

      # Skip local actions (./) and docker:// uses
      if [[ "$action_path" == ./* || "$action_path" == docker://* ]]; then
        echo "$line" >> "$tmp"
        continue
      fi

      # Already pinned
      if is_sha "$ref"; then
        echo "$line" >> "$tmp"
        continue
      fi

      # Extract owner/repo (first two path segments)
      local owner_repo
      owner_repo=$(echo "$action_path" | cut -d/ -f1-2)

      # Skip self-references (the repo publishing the action == this repo)
      if [[ -n "$SELF_SLUG" && "$owner_repo" == "$SELF_SLUG" ]]; then
        echo "$line" >> "$tmp"
        continue
      fi

      local sha
      if ! sha=$(resolve_sha "$owner_repo" "$ref"); then
        echo "WARN: could not resolve ${owner_repo}@${ref} — leaving as-is" >&2
        echo "$line" >> "$tmp"
        continue
      fi

      # Rebuild trailing comment: drop any pre-existing `# ...` and replace with ref.
      local new_line="${lead}${action_path}@${sha} # ${ref}"
      echo "$new_line" >> "$tmp"

      if [[ "$line" != "$new_line" ]]; then
        changed=$((changed + 1))
        echo "  ${action_path}@${ref} -> ${sha}"
      fi
    else
      echo "$line" >> "$tmp"
    fi
  done < "$file"

  if [[ "$changed" -gt 0 ]]; then
    if [[ "$MODE" == "apply" ]]; then
      mv "$tmp" "$file"
      echo "APPLIED: $file ($changed change(s))"
    else
      rm -f "$tmp"
      echo "DRY-RUN: $file ($changed change(s) — pass --apply to write)"
    fi
  else
    rm -f "$tmp"
  fi
}

# Build the file list
FILES=()
if [[ -f "$TARGET" ]]; then
  FILES+=("$TARGET")
elif [[ -d "$TARGET" ]]; then
  while IFS= read -r -d '' f; do
    FILES+=("$f")
  done < <(find "$TARGET" -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)
else
  echo "ERROR: $TARGET is neither a file nor a directory" >&2
  exit 1
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No YAML files found under $TARGET"
  exit 0
fi

echo "Mode: $MODE"
echo "Self repo: ${SELF_SLUG:-<unknown>}"
echo "Scanning ${#FILES[@]} file(s)..."
echo

for f in "${FILES[@]}"; do
  process_file "$f"
done

echo
echo "Done."
