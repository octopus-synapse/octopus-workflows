/**
 * Attestation — tree-hash based proof that pre-commit checks actually ran.
 *
 * Ported (in behavior) from profile-services/scripts/attestation.sh so CI
 * verification stays compatible. The file format (`.attestation` JSON v3)
 * matches 1:1 so legacy commits on profile-services can still be verified
 * by the new TS version.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const ATTESTATION_FILE = '.attestation';
export const ATTESTATION_VERSION = '3';

export interface AttestationMetrics {
  [suite: string]: {
    status: 'ok' | 'fail';
    time_ms: number;
    passed?: number;
    failed?: number;
    skipped?: number;
  };
}

export interface Attestation {
  version: string;
  tree_hash: string;
  checks: string;
  metrics: AttestationMetrics;
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

export interface GenerateOptions {
  checks: string[];
  metrics?: AttestationMetrics;
}

export function generateAttestation(options: GenerateOptions): Attestation {
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
    metrics: options.metrics ?? {},
    timestamp,
    git_user,
  };

  writeFileSync(ATTESTATION_FILE, `${JSON.stringify(attestation, null, 2)}\n`);
  sh(`git add ${ATTESTATION_FILE}`);

  return attestation;
}

export interface VerifyResult {
  ok: boolean;
  attestedHash: string;
  currentHash: string;
  attestation?: Attestation;
  ageHours?: number;
  reason?: string;
}

export function verifyAttestation(): VerifyResult {
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

  // Reconstruct the tree of the current commit with .attestation stripped.
  // Runs against git objects so it works reliably in CI (no index required).
  const commitTree = sh('git rev-parse HEAD^{tree}');
  const currentHash = sh(
    `git ls-tree ${commitTree} | grep -vE '\\.attestation$' | git mktree`,
  );

  const ageMs = Date.now() - new Date(attestation.timestamp).getTime();
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

  if (attestedHash !== currentHash) {
    return {
      ok: false,
      attestedHash,
      currentHash,
      attestation,
      ageHours,
      reason:
        'Tree hash mismatch. Code was modified after pre-commit checks ran (or attestation was forged, or commit was amended).',
    };
  }

  return {
    ok: true,
    attestedHash,
    currentHash,
    attestation,
    ageHours,
  };
}
