#!/bin/sh
# verify.sh — tree-hash verification for @octopus-synapse/precommit .attestation
#
# Runs inside the pre-built Docker action image. The consumer repo is mounted
# at /github/workspace (GH Actions convention). Exit 0 on pass, 1 on fail.
#
# Inputs (from env):
#   STRICT         'true'|'false' — fail when .attestation is missing
#   MAX_AGE_HOURS  integer — warn when attestation is older than N hours

set -eu

: "${STRICT:=true}"
: "${MAX_AGE_HOURS:=72}"

cd /github/workspace

# Git complains about the mounted workspace being owned by a different UID
# than the container user. This is safe because we only read; declare it.
git config --global --add safe.directory /github/workspace

if [ ! -f .attestation ]; then
  if [ "$STRICT" = "true" ]; then
    echo "::error::No .attestation file. Commit may have bypassed pre-commit hooks."
    exit 1
  fi
  echo "::warning::No .attestation file; continuing because strict=false."
  exit 0
fi

attested_hash=$(jq -r '.tree_hash' .attestation)
if [ -z "$attested_hash" ] || [ "$attested_hash" = "null" ]; then
  echo "::error::Invalid attestation format — missing tree_hash field."
  exit 1
fi

# Reconstruct the tree of HEAD with .attestation stripped. Operates on git
# objects directly so it doesn't need the index populated.
commit_tree=$(git rev-parse "HEAD^{tree}")
current_hash=$(git ls-tree "$commit_tree" | grep -vE '\.attestation$' | git mktree)

echo "attested: $attested_hash"
echo "current:  $current_hash"

if [ "$attested_hash" != "$current_hash" ]; then
  echo "::error::Tree hash mismatch — code was modified after pre-commit checks (or attestation was forged, or commit was amended)."
  exit 1
fi

# Age warning (non-fatal).
timestamp=$(jq -r '.timestamp // empty' .attestation)
if [ -n "$timestamp" ]; then
  attested_epoch=$(date -d "$timestamp" +%s 2>/dev/null || echo 0)
  now_epoch=$(date +%s)
  if [ "$attested_epoch" -gt 0 ]; then
    age_hours=$(( (now_epoch - attested_epoch) / 3600 ))
    if [ "$age_hours" -gt "$MAX_AGE_HOURS" ]; then
      echo "::warning::Attestation is ${age_hours}h old (threshold: ${MAX_AGE_HOURS}h)."
    fi
  fi
fi

echo "✓ attestation verified"
