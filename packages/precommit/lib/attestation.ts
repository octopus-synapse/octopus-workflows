/**
 * Attestation — tree-hash based proof that pre-commit checks actually ran.
 *
 * Ported (in behavior) from profile-services/scripts/attestation.sh so CI
 * verification stays compatible. Format v4 adds a `runtime` block on top of
 * v3; verification of the extra fields is opt-in, so v3 attestations written
 * by older clients keep verifying unchanged.
 *
 * What the attestation is and is not: it proves that the named checks ran and
 * passed against *this exact tree*, on a developer machine, under a recorded
 * runtime. It is not a signature — it defends against honest mistakes (a
 * forgotten `git add`, an amended commit, a stale toolchain), not against a
 * developer who sets out to forge it.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const ATTESTATION_FILE = '.attestation';
export const ATTESTATION_VERSION = '4';

export interface AttestationMetrics {
  [suite: string]: {
    status: 'ok' | 'fail';
    time_ms: number;
    passed?: number;
    failed?: number;
    skipped?: number;
  };
}

/** Toolchain the checks actually ran under. Absent on v3 attestations. */
export interface AttestationRuntime {
  /** `bun --version` at the time the checks ran. */
  bun: string;
  /** Resolved timezone — recorded for debugging, never verified. */
  tz: string;
}

export interface Attestation {
  version: string;
  tree_hash: string;
  checks: string;
  metrics: AttestationMetrics;
  runtime?: AttestationRuntime;
  timestamp: string;
  git_user: string;
}

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function shSilent(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Tree of `ref` with the top-level `.attestation` entry stripped.
 *
 * Operates on git objects so it works without a populated index (CI) and
 * against the staged tree (pre-commit). The filename column is compared
 * exactly: an earlier `grep -vE '\.attestation$'` also swallowed entries that
 * merely *ended* with `.attestation` (`release.attestation`).
 */
function treeHashOf(ref: string): string {
  const commitTree = sh(`git rev-parse ${ref}^{tree}`);
  return sh(`git ls-tree ${commitTree} | awk -F '\\t' '$2 != ".attestation"' | git mktree`);
}

function detectRuntime(): AttestationRuntime {
  return {
    bun: shSilent('bun --version') || 'unknown',
    tz: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
  };
}

/**
 * Refuse to attest a check that has no passing metric behind it.
 *
 * Without this the `checks` field is just a string the caller typed, and
 * `--checks "lint"` produces an attestation that verifies exactly as well as
 * one where the whole suite ran. Deriving the claim from what the runner
 * actually recorded is what makes the field mean anything.
 */
function assertChecksPassed(checks: string[], metrics: AttestationMetrics): void {
  const problems: string[] = [];

  for (const name of checks) {
    const metric = metrics[name];
    if (!metric) {
      problems.push(`${name}: no metrics recorded — the check did not run`);
      continue;
    }
    if (metric.status !== 'ok') {
      problems.push(`${name}: status=${metric.status}`);
    }
    if ((metric.failed ?? 0) > 0) {
      problems.push(`${name}: ${metric.failed} failing test(s)`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to attest — claimed checks are not backed by passing metrics:\n  ${problems.join('\n  ')}`,
    );
  }
}

export interface GenerateOptions {
  checks: string[];
  metrics?: AttestationMetrics;
}

export function generateAttestation(options: GenerateOptions): Attestation {
  const metrics = options.metrics ?? {};
  assertChecksPassed(options.checks, metrics);

  // Remove any previous .attestation from the index so the tree hash we compute
  // reflects the code being committed, not whatever attestation was last staged.
  shSilent(`git rm --cached ${ATTESTATION_FILE}`);

  const tree_hash = sh('git write-tree');
  const git_user = shSilent('git config user.email') || 'unknown';
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const attestation: Attestation = {
    version: ATTESTATION_VERSION,
    tree_hash,
    checks: options.checks.join(' '),
    metrics,
    runtime: detectRuntime(),
    timestamp,
    git_user,
  };

  writeFileSync(ATTESTATION_FILE, `${JSON.stringify(attestation, null, 2)}\n`);
  sh(`git add ${ATTESTATION_FILE}`);

  return attestation;
}

export interface VerifyOptions {
  /** Checks the attestation must claim. Empty means "don't care" (v3 behavior). */
  requireChecks?: string[];
  /** Fail when any recorded metric is not `ok`, or reports failing tests. */
  requirePassing?: boolean;
  /** Fail unless `runtime.bun` matches `.bun-version` in the attested tree. */
  requireRuntime?: boolean;
  /** Commit to verify against. Defaults to HEAD. */
  ref?: string;
}

export interface VerifyResult {
  ok: boolean;
  attestedHash: string;
  currentHash: string;
  attestation?: Attestation;
  ageHours?: number;
  reason?: string;
}

export function verifyAttestation(options: VerifyOptions = {}): VerifyResult {
  const ref = options.ref ?? 'HEAD';

  if (!existsSync(ATTESTATION_FILE)) {
    return {
      ok: false,
      attestedHash: '',
      currentHash: '',
      reason:
        'No attestation file found. Commit was made with --no-verify or without running pre-commit checks.',
    };
  }

  let attestation: Attestation;
  try {
    attestation = JSON.parse(readFileSync(ATTESTATION_FILE, 'utf8')) as Attestation;
  } catch (err) {
    return {
      ok: false,
      attestedHash: '',
      currentHash: '',
      reason: `Invalid attestation format: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  const attestedHash = attestation.tree_hash;
  if (!attestedHash) {
    return {
      ok: false,
      attestedHash: '',
      currentHash: '',
      attestation,
      reason: 'Attestation missing tree_hash field',
    };
  }

  const currentHash = treeHashOf(ref);

  const ageMs = Date.now() - new Date(attestation.timestamp).getTime();
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
  const base = { attestedHash, currentHash, attestation, ageHours };

  if (attestedHash !== currentHash) {
    return {
      ok: false,
      ...base,
      reason:
        'Tree hash mismatch. Code was modified after pre-commit checks ran (or attestation was forged, or commit was amended).',
    };
  }

  // Policy checks below are opt-in: with none of them requested this behaves
  // exactly like v3 verification, so repos still on the old format pass.
  const policyFailure = checkPolicy(attestation, options, ref);
  if (policyFailure) {
    return { ok: false, ...base, reason: policyFailure };
  }

  return { ok: true, ...base };
}

function checkPolicy(
  attestation: Attestation,
  options: VerifyOptions,
  ref: string,
): string | undefined {
  const required = options.requireChecks ?? [];
  if (required.length > 0) {
    const claimed = new Set(attestation.checks.split(/\s+/).filter(Boolean));
    const missing = required.filter((name) => !claimed.has(name));
    if (missing.length > 0) {
      return `Attestation does not cover required checks: ${missing.join(', ')} (claims: ${attestation.checks || 'none'})`;
    }
  }

  if (options.requirePassing) {
    const failures = Object.entries(attestation.metrics ?? {})
      .filter(([, m]) => m.status !== 'ok' || (m.failed ?? 0) > 0)
      .map(([name, m]) => `${name} (status=${m.status}, failed=${m.failed ?? 0})`);
    if (failures.length > 0) {
      return `Attestation records failing checks: ${failures.join(', ')}`;
    }
    if (Object.keys(attestation.metrics ?? {}).length === 0) {
      return 'Attestation records no metrics, so no check can be shown to have passed.';
    }
  }

  if (options.requireRuntime) {
    const attestedBun = attestation.runtime?.bun;
    if (!attestedBun) {
      return `Attestation has no runtime block (format v${attestation.version}); regenerate it with a client that records one.`;
    }
    // Read the pin from the attested tree, not from disk: on a pull_request
    // run the working directory holds the merge ref, not the commit we verify.
    const pinned = shSilent(`git show ${ref}:.bun-version`);
    if (!pinned) {
      return 'No .bun-version in the attested tree, so the recorded runtime cannot be checked.';
    }
    if (pinned !== attestedBun) {
      return `Runtime mismatch: checks ran on bun ${attestedBun}, but .bun-version pins ${pinned}.`;
    }
  }

  return undefined;
}
