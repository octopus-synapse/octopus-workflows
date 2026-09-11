#!/usr/bin/env node
/**
 * octopus-attest CLI
 *
 * Usage:
 *   octopus-attest generate --checks "typecheck,lint" [--metrics-file .metrics.json]
 *   octopus-attest verify [--require-checks "typecheck,lint"] [--require-passing]
 *                         [--require-runtime] [--ref HEAD] [--max-age-hours 72]
 *
 * `generate` refuses to write an attestation for a check that has no passing
 * metric behind it, so the `checks` field describes what actually ran. The
 * `--require-*` flags on `verify` are opt-in, so a v3 attestation written by an
 * older client still verifies when none of them are passed.
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

function parseList(raw: string | undefined): string[] {
  if (!raw || raw === 'true') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function main(): void {
  const { cmd, flags } = parseArgs(process.argv.slice(2));

  if (cmd === 'generate') {
    const checks = parseList(flags.checks ?? 'lint,typecheck,test');
    const metricsPath = flags['metrics-file'] ?? '.attestation-metrics.json';
    const metrics = loadMetrics(metricsPath);

    let result: ReturnType<typeof generateAttestation>;
    try {
      result = generateAttestation({ checks, metrics });
    } catch (err) {
      console.error(`[attestation] FAILED: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`[attestation]   metrics file: ${metricsPath}`);
      process.exit(1);
    }
    console.log(`[attestation] generated: ${result.tree_hash}`);
    console.log(`[attestation]   checks: ${result.checks}`);
    process.exit(0);
  }

  if (cmd === 'verify') {
    const maxAgeHours = Number(flags['max-age-hours'] ?? '24');
    const result = verifyAttestation({
      requireChecks: parseList(flags['require-checks']),
      requirePassing: flags['require-passing'] === 'true',
      requireRuntime: flags['require-runtime'] === 'true',
      ref: flags.ref,
    });

    if (!result.ok) {
      console.error(`[attestation] FAILED: ${result.reason}`);
      if (result.attestedHash) console.error(`[attestation]   attested: ${result.attestedHash}`);
      if (result.currentHash) console.error(`[attestation]   current:  ${result.currentHash}`);
      process.exit(1);
    }
    console.log(`[attestation] verified: ${result.attestedHash}`);
    if (result.ageHours !== undefined && result.ageHours > maxAgeHours) {
      console.warn(`[attestation] WARN: attestation is ${result.ageHours}h old`);
    }
    process.exit(0);
  }

  console.error(`Usage: octopus-attest <generate|verify> [options]`);
  process.exit(2);
}

main();
