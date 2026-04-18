#!/usr/bin/env node
/**
 * postinstall hook — bootstraps the two files every consumer repo needs to
 * resolve `@octopus-synapse/*` packages from GitHub Packages:
 *   - `.npmrc`     — scoped registry + token env ref (npm/yarn/pnpm)
 *   - `bunfig.toml` — scoped auth config (bun)
 *
 * Idempotent: only creates files that don't already exist. Never overwrites
 * user-tweaked versions. Scoped to the repo root (CWD of the install),
 * skipped when INIT_CWD is unavailable (e.g., running the package standalone).
 */

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function repoRoot(): string | null {
  const init = process.env.INIT_CWD;
  if (!init) return null;
  // Skip when this package is installed inside its own workspace during CI.
  if (init.includes('@octopus-synapse/precommit')) return null;
  return init;
}

function writeIfMissing(path: string, contents: string, label: string): void {
  if (existsSync(path)) {
    // Stay silent when it exists — the user (or a previous install) already
    // handled it; we don't want to spam the install log.
    return;
  }
  writeFileSync(path, contents);
  console.log(`[@octopus-synapse/precommit] wrote ${label} at ${path}`);
}

const NPMRC = `@octopus-synapse:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}
`;

const BUNFIG = `[install.scopes]
"@octopus-synapse" = { token = "$GITHUB_TOKEN", url = "https://npm.pkg.github.com/" }
`;

function main(): void {
  const root = repoRoot();
  if (!root) return;

  try {
    writeIfMissing(join(root, '.npmrc'), NPMRC, '.npmrc');
    writeIfMissing(join(root, 'bunfig.toml'), BUNFIG, 'bunfig.toml');
  } catch (err) {
    // Never block install on postinstall — just warn.
    console.warn(
      `[@octopus-synapse/precommit] postinstall skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

main();
