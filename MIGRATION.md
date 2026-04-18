# Octopus Synapse — CI/CD standardization rollout

This scaffold replaces the current content of the `octopus-workflows` repo and
bootstraps a shared CI/CD + pre-commit toolkit consumed by
`profile-services` and `patch-careers-ui`.

## What was done locally

### `octopus-workflows-scaffold/` (this directory)

Ready to push as the `main` branch of `octopus-synapse/octopus-workflows`:

- Bun monorepo (`packages/*` workspaces, `.bun-version = 1.3.11`).
- 9 composite actions in `.github/actions/`:
  - Ported from profile-services: `setup-bun-env`, `run-test-suite`,
    `evaluate-ci-results`, `calculate-version`, `detect-release-type`,
    `generate-changelog`, `setup-git-bot`.
  - NEW: `verify-attestation` (CI gate against `.attestation` tree hash),
    `post-ci-comment` (markdown-only, no SVG).
- 5 reusable workflow templates in `.github/workflows/_*.yml`.
- NEW workflow: `_ci-main-template.yml` (pluggable orchestrator) and
  `publish-packages.yml` (publishes the 3 packages on `v*.*.*` tags).
- 2 shared scripts (`parse-test-output.sh`, `generate-summary.sh`).
- 3 NPM packages ready to publish to GitHub Packages:
  - `@octopus-synapse/precommit` — CLI `octopus-attest generate|verify` +
    `octopus-run-parallel` (parallel check runner + metrics emitter).
  - `@octopus-synapse/biome-config` — canonical `biome.json`.
  - `@octopus-synapse/commitlint-config` — conventional commits rules.

### `patch-careers-ui/` (the consumer)

Configured with **inline / vendored** versions of the shared pieces so the
repo is fully functional *today*, before any of the NPM packages are
published. Each file has a `TODO(migration):` comment pointing to the
1-line swap once `octopus-workflows@v1` is out.

Added:
- `.husky/pre-commit` (parallel typecheck + lint via Turbo) + `.husky/commit-msg`.
- `scripts/attestation.sh` (vendored from profile-services).
- `.precommit.yaml` (declarative checks, consumed by the future run-parallel CLI).
- `biome.json` (inline canonical config + Svelte override).
- `commitlint.config.ts` (inline canonical rules).
- `.bun-version`, `.editorconfig`.
- Root `package.json`: `typecheck`, `lint`, `lint:fix`, `format`, `test:e2e`, `prepare`
  scripts + devDeps (biome, commitlint, husky).
- `packages/api-client`, `packages/ui`, `packages/i18n`: `check: tsc --noEmit`.
- `.github/workflows/ci.yml`, `ci.build.yml`, `ci.infrastructure.e2e.yml`,
  `release.yml`, `pr-comment.yml` (old `cd.yml` deleted).
- `.github/CODEOWNERS`, `.github/dependabot.yml`.

## Next steps — in order

### 1. Push `octopus-workflows-scaffold/` as the new `octopus-workflows`

```bash
cd octopus-workflows-scaffold
git init -b main
git remote add origin git@github.com:octopus-synapse/octopus-workflows.git
git add .
git commit -m "feat: initial v1 with shared actions, templates, and NPM packages"
# If the old content is already on GitHub and you chose 'overwrite':
git push --force-with-lease origin main
# First tagged release:
git tag v1.0.0
git push origin v1.0.0
# Moving major tag:
git tag v1
git push origin v1
```

`publish-packages.yml` will run automatically on the `v1.0.0` push and
publish the 3 packages to GitHub Packages.

Verify: https://github.com/orgs/octopus-synapse/packages should list
`@octopus-synapse/precommit`, `biome-config`, `commitlint-config`.

### 2. `patch-careers-ui` — install the published packages

```bash
cd patch-careers-ui
bun install                        # picks up the new devDeps + runs husky install
bunx husky install                 # explicit if `prepare` didn't run
git add -A && bun run lint         # shakes out immediate lint noise
```

Optional swap once the packages are live:

- `biome.json` → `{ "extends": ["@octopus-synapse/biome-config/biome.json"] }`
- `commitlint.config.ts` → `import base from '@octopus-synapse/commitlint-config'; export default base;`
- `.husky/pre-commit` → `bunx octopus-run-parallel --config .precommit.yaml && bunx octopus-attest generate --checks "typecheck,lint"`
- CI workflows: swap local `uses: ./...` for `uses: octopus-synapse/octopus-workflows/...@v1`.
- Delete `scripts/attestation.sh` (superseded by the CLI).

### 3. `profile-services` — migrate to the shared artifacts (last)

Order this AFTER the ui migration has gone through one successful PR + release,
so you've validated the shared pieces with a real consumer before touching the
repo that's already in production.

Steps (documented here so a later session can execute without re-planning):

1. Add `@octopus-synapse/precommit`, `biome-config`, `commitlint-config` as
   devDeps.
2. Replace `biome.json` / `commitlint.config.ts` with `extends` / re-export.
3. Shrink `.husky/pre-commit` to the 2-line CLI invocation (adding the
   existing swagger-generation step to `.precommit.yaml`'s `serial:` list).
4. In each `.github/workflows/*.yml`, replace `uses: ./.github/actions/...`
   with `uses: octopus-synapse/octopus-workflows/.github/actions/...@v1`.
5. Replace refs to local `_*.yml` templates with `@v1` refs too.
6. Delete `.github/actions/*/`, `.github/scripts/*.sh`, `scripts/attestation.sh`.
7. Delete `.github/actions/post-ci-card/` and wire `pr-comment.yml` to
   `post-ci-comment@v1`.
8. Open a PR titled `chore(ci): adopt octopus-workflows@v1` — all existing
   checks should still pass with identical durations.

## Key decisions (locked)

- NPM packages distributed via **GitHub Packages** (npm.pkg.github.com).
- Workflows pinned by **moving tag `v1`**; SHAs only if/when a consumer wants
  extra supply-chain rigor.
- Pre-commit attestation format is **v3** — identical to the current
  profile-services `.attestation`, so cross-repo migration is lossless.
- UI parallelization uses **Turbo** (`bunx turbo run check`) because it already
  knows the workspace dependency graph; backend keeps its explicit
  background-pid pattern because it has no monorepo to parallelize by.
- Release flow is **manual via `workflow_dispatch.force_release_type`** (with
  conventional-commit inference as fallback).
- Single-version monorepo in UI (`package.json` at root is the source of
  truth; packages don't publish independently).

## What to check when you wake up

1. `octopus-workflows-scaffold/` tree looks sane (`ls -R | head -40`).
2. `patch-careers-ui` is in a commit-able state: run `git status` — only new
   files, no accidental deletions outside the expected (`cd.yml`).
3. If you want to smoke-test the pre-commit *before* publishing packages:
   the hook as-written uses the vendored `scripts/attestation.sh` and calls
   `bunx turbo run check` + `bunx biome check .`. Both should work after
   `bun install` (assuming biome finds no fatal issues).
