#!/usr/bin/env bun
/**
 * CLI: Calculate Next Version
 *
 * Usage: bun calc-version.ts <current-version> <release-type> [--with-prefix]
 *
 * Examples:
 *   bun calc-version.ts 1.2.3 patch         → 1.2.4
 *   bun calc-version.ts v1.2.3 minor        → 1.3.0
 *   bun calc-version.ts 1.2.3 major --with-prefix → v2.0.0
 */

import { z } from 'zod';
import { isValidReleaseType, type ReleaseType } from '../domain/release-type';
import {
  calculateNextVersion,
  formatVersion,
  formatVersionWithPrefix,
  parseVersion,
} from '../domain/version';

const ArgsSchema = z.object({
  currentVersion: z.string().regex(/^v?\d+\.\d+\.\d+$/, 'Invalid semver'),
  releaseType: z.string().refine(isValidReleaseType, 'Invalid release type'),
  withPrefix: z.boolean().default(false),
});

function printUsage(): void {
  console.error('Usage: calc-version <current-version> <release-type> [--with-prefix]');
  console.error('');
  console.error('Arguments:');
  console.error('  current-version  Current semver (e.g., 1.2.3 or v1.2.3)');
  console.error('  release-type     One of: major, minor, patch');
  console.error('');
  console.error('Options:');
  console.error('  --with-prefix    Output with v prefix (e.g., v1.2.4)');
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const parsed = ArgsSchema.safeParse({
    currentVersion: args[0],
    releaseType: args[1],
    withPrefix: args.includes('--with-prefix'),
  });

  if (!parsed.success) {
    console.error('Error:', parsed.error.flatten().fieldErrors);
    printUsage();
    process.exit(1);
  }

  const { currentVersion, releaseType, withPrefix } = parsed.data;

  const current = parseVersion(currentVersion);
  const next = calculateNextVersion(current, releaseType as ReleaseType);
  const output = withPrefix ? formatVersionWithPrefix(next) : formatVersion(next);

  console.log(output);
}

main();
