# Renovate shared preset (`octopus-synapse/renovate-config`)

This directory holds the source of the shared Renovate preset for the
`octopus-synapse` org. The actual preset lives in a separate repo so other
org repos can extend it via `github>octopus-synapse/renovate-config`.

## Files

- `default.json` — the shareable Renovate config. Anything in here applies
  to every repo that extends `github>octopus-synapse/renovate-config`.

## One-time setup (owner-only)

This requires GitHub org admin permissions and is not automated:

```bash
# 1. Create the public repo
gh repo create octopus-synapse/renovate-config \
  --public \
  --description "Shared Renovate preset for octopus-synapse org" \
  --add-readme

# 2. Clone, drop default.json in at the root, and push
gh repo clone octopus-synapse/renovate-config /tmp/renovate-config
cp default.json /tmp/renovate-config/default.json
cd /tmp/renovate-config
git add default.json
git commit -m "feat: initial preset (pinDigests + automerge for github-actions)"
git push origin main
```

## Consumer repos

Once the preset repo exists, any repo in the org can reduce its
`renovate.json` to just:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>octopus-synapse/renovate-config"]
}
```

This repo (`octopus-workflows`) already uses that pattern — see
`/renovate.json` at the project root.

## Updating the preset

Edit `default.json` here first (review in this repo's PR), then mirror the
change into the `renovate-config` repo's `default.json`. The mirror is
manual to keep the preset auditable.
