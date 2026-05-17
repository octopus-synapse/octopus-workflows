#!/usr/bin/env bash
# Apply standard branch protection to the `main` branch of a repository.
#
# Usage:
#   ./bootstrap-protection.sh <owner/repo>            # apply
#   ./bootstrap-protection.sh --dry-run <owner/repo>  # print body, do not call API
#
# Protection rules applied:
#   - Require pull-request review (1 approver, dismiss stale reviews)
#   - Require status checks to pass and branch up-to-date (context: "ci")
#   - Require linear history
#   - Require conversation resolution before merge
#   - Disallow force pushes
#   - Disallow branch deletion
#   - Enforce protection on admins
#
# Requires:
#   - gh CLI authenticated (`gh auth status`) as an org admin

set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
  shift
fi

if [ $# -ne 1 ]; then
  echo "Usage: $0 [--dry-run] <owner/repo>" >&2
  exit 2
fi

REPO="$1"

if ! [[ "$REPO" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]]; then
  echo "::error::Invalid repo format '$REPO' (expected owner/repo)" >&2
  exit 2
fi

BODY='{
  "required_status_checks": {"strict": true, "contexts": ["ci"]},
  "enforce_admins": true,
  "required_pull_request_reviews": {"required_approving_review_count": 1, "dismiss_stale_reviews": true},
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "restrictions": null
}'

echo "==> Target: $REPO (branch: main)"
echo "==> Body:"
echo "$BODY"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "==> Dry-run mode: not applying."
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "::error::gh CLI not found in PATH" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "::error::gh CLI is not authenticated (run 'gh auth login')" >&2
  exit 1
fi

echo "==> Applying branch protection via GitHub API..."
echo "$BODY" | gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/$REPO/branches/main/protection" \
  --input -

echo "==> Done. Verify with: gh api repos/$REPO/branches/main/protection"
