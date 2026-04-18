# octopus-workflows

Shared GitHub Actions, reusable workflow templates, scripts, and NPM config
packages for **Octopus Synapse** repos. Consumed by `profile-services`,
`patch-careers-ui`, and any future repo in the org.

## Layout

```
.github/
  workflows/                      reusable templates (workflow_call)
    _ci-main-template.yml         orchestrator (which tiers to run)
    _static-analysis-template.yml unit/arch/contract suites
    _infrastructure-test-template.yml integration + e2e with service deps
    _release-create-pr.yml        release PR bot (homolog)
    _release-finalize.yml         release finalize (main)
    _release-docker.yml           Docker build + GHCR publish
    publish-packages.yml          publishes packages/* on v* tags
  actions/                        composite actions
    setup-bun-env/                Bun + node_modules + optional Prisma cache
    run-test-suite/               unified test runner with parsed metrics
    evaluate-ci-results/          aggregates tier results → step summary
    verify-attestation/           CI gate that checks .attestation tree_hash
    post-ci-comment/              markdown status comment on PRs (no SVG)
    calculate-version/            semver bump from conventional commits
    detect-release-type/          decide major|minor|patch
    generate-changelog/           render CHANGELOG section per release
    setup-git-bot/                git config identity for bot commits
  scripts/
    parse-test-output.sh          shared test-output regex
    generate-summary.sh           markdown tables for step summary

packages/
  precommit/                      @octopus-synapse/precommit
    bin/attest.ts                 CLI: generate|verify attestation
    bin/run-parallel.ts           parallel check runner + metrics emitter
    lib/attestation.ts            tree-hash attestation core
    lib/metrics.ts                Bun/Vitest/Jest/Playwright metric extractors
  biome-config/                   @octopus-synapse/biome-config
    biome.json                    canonical config (100 char, single quotes)
  commitlint-config/              @octopus-synapse/commitlint-config
    index.ts                      conventional commits + subject rules
```

## Versioning

- Tags: `v1.0.0`, `v1.1.0`, … (patch/minor bumps inside `v1` are backwards-compatible).
- Moving tag `v1` points to the latest `v1.*.*` so consumers pin via `@v1`.
- Breaking changes bump to `v2` with a new moving tag.

## Consumer usage

### Reference a workflow template

```yaml
# consumer-repo/.github/workflows/ci.infrastructure.e2e.yml
jobs:
  e2e:
    uses: octopus-synapse/octopus-workflows/.github/workflows/_infrastructure-test-template.yml@v1
    with:
      test-command: 'bun run test:e2e'
      services: 'postgres,redis,minio,libretranslate'
    secrets: inherit
```

### Use a composite action

```yaml
- uses: octopus-synapse/octopus-workflows/.github/actions/setup-bun-env@v1
  with:
    with-prisma: 'false'
```

### Install the precommit package

```bash
bun add -d @octopus-synapse/precommit
```

Then in `.husky/pre-commit`:

```sh
#!/bin/sh
bunx octopus-run-parallel --config .precommit.yaml
bunx octopus-attest generate --checks "typecheck,lint"
```

### Extend the Biome config

```json
{
  "extends": ["@octopus-synapse/biome-config/biome.json"]
}
```

## Publishing

Push a `v*.*.*` tag to trigger `publish-packages.yml`. The workflow:
1. Builds `packages/precommit`.
2. Publishes all 3 packages to GitHub Packages (registry `npm.pkg.github.com`).
3. Force-moves the matching major tag (e.g., `v1`) to the same commit.

Consumers authenticated to GitHub Packages (via `GITHUB_TOKEN` in CI or a PAT
locally) then get the new version on next `bun install`.

## Bootstrap from this scaffold

This directory was generated as a scaffold to bootstrap the `octopus-workflows`
repo. To adopt it:

```bash
cd octopus-workflows-scaffold
git init
git remote add origin git@github.com:octopus-synapse/octopus-workflows.git
git add .
git commit -m "feat: initial release with shared workflows, actions, and NPM packages"
git tag v1.0.0
git push origin main --tags
```

Then in GitHub Packages settings, ensure the org allows `@octopus-synapse/*` scopes.
