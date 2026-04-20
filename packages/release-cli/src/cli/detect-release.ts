#!/usr/bin/env bun
/**
 * CLI: Detect Release Type
 *
 * Usage:
 *   bun detect-release.ts --labels="patch,bug,feature"
 *   echo '["patch", "bug"]' | bun detect-release.ts --stdin
 *
 * Output:
 *   major, minor, patch, or empty string (no release label found)
 */

import { detectReleaseType } from '../domain/release-type';

function printUsage(): void {
  console.error('Usage: detect-release --labels="label1,label2,..." | --stdin');
  console.error('');
  console.error('Options:');
  console.error('  --labels=<csv>  Comma-separated list of labels');
  console.error('  --stdin         Read JSON array of labels from stdin');
  console.error('');
  console.error('Output:');
  console.error('  major, minor, patch, or empty string if no release label');
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for --stdin mode
  if (args.includes('--stdin')) {
    try {
      const input = await readStdin();
      const labels = JSON.parse(input.trim()) as string[];

      if (!Array.isArray(labels)) {
        throw new Error('Expected JSON array');
      }

      const releaseType = detectReleaseType(labels);
      console.log(releaseType ?? '');
      return;
    } catch (error) {
      console.error('Error parsing stdin:', error);
      process.exit(1);
    }
  }

  // Check for --labels=<csv> mode
  const labelsArg = args.find((arg) => arg.startsWith('--labels='));

  if (labelsArg) {
    const csv = labelsArg.replace('--labels=', '');
    const labels = csv
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);

    const releaseType = detectReleaseType(labels);
    console.log(releaseType ?? '');
    return;
  }

  // No valid input mode
  printUsage();
  process.exit(1);
}

main();
