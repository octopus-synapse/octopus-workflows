#!/usr/bin/env node
/**
 * octopus-attest CLI
 *
 * Usage:
 *   octopus-attest generate --checks "typecheck,lint" [--metrics-file .metrics.json]
 *   octopus-attest verify
 *
 * Behavior matches profile-services/scripts/attestation.sh so existing commits
 * stay verifiable after the migration.
 */

import { existsSync, readFileSync } from 'node:fs';
import {
  type AttestationMetrics,
  generateAttestation,
  verifyAttestation,
} from '../lib/attestation.js';

function parseArgs(argv: string[]): { cmd: string; flags: Record<string, string> } {
  const [cmd = 'generate', ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = 'true';
      } else {
        flags[key] = next;
        i += 1;
      }
    }
  }
  return { cmd, flags };
}

function loadMetrics(path: string): AttestationMetrics {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as AttestationMetrics;
  } catch {
    return {};
  }
}

function main(): void {
  const { cmd, flags } = parseArgs(process.argv.slice(2));

  if (cmd === 'generate') {
    const rawChecks = flags.checks ?? 'lint,typecheck,test';
    const checks = rawChecks
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const metricsPath = flags['metrics-file'] ?? '.attestation-metrics.json';
    const metrics = loadMetrics(metricsPath);

    const result = generateAttestation({ checks, metrics });
    console.log(`[attestation] generated: ${result.tree_hash}`);
    process.exit(0);
  }

  if (cmd === 'verify') {
    const result = verifyAttestation();
    if (!result.ok) {
      console.error(`[attestation] FAILED: ${result.reason}`);
      if (result.attestedHash) console.error(`[attestation]   attested: ${result.attestedHash}`);
      if (result.currentHash) console.error(`[attestation]   current:  ${result.currentHash}`);
      process.exit(1);
    }
    console.log(`[attestation] verified: ${result.attestedHash}`);
    if (result.ageHours !== undefined && result.ageHours > 24) {
      console.warn(`[attestation] WARN: attestation is ${result.ageHours}h old`);
    }
    process.exit(0);
  }

  console.error(`Usage: octopus-attest <generate|verify> [options]`);
  process.exit(2);
}

main();
