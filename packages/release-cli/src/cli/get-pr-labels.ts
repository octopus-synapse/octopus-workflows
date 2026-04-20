#!/usr/bin/env bun
/**
 * CLI: Get PR Labels
 *
 * Gets labels from a PR associated with a commit SHA.
 *
 * Usage:
 *   bun get-pr-labels.ts --sha=abc123 --owner=owner --repo=repo
 *   bun get-pr-labels.ts --labels="patch,bug"  # Bypass API, output directly
 *
 * Environment:
 *   GITHUB_TOKEN - Required for API access (not needed with --labels)
 *
 * Output:
 *   Comma-separated list of labels (e.g., "patch,bug,enhancement")
 */

import { z } from 'zod';
import { createGitHubClient } from '../infrastructure/github-client';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executes a function with exponential backoff retry.
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 1000): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}

const ArgsSchema = z
  .object({
    sha: z.string().optional(),
    owner: z.string().optional(),
    repo: z.string().optional(),
    labels: z.string().optional(),
  })
  .refine((data) => data.labels !== undefined || (data.sha && data.owner && data.repo), {
    message: 'Either --labels or (--sha, --owner, --repo) is required',
  });

function printUsage(): void {
  console.error('Usage: get-pr-labels --sha=<commit> --owner=<owner> --repo=<repo>');
  console.error('       get-pr-labels --labels="label1,label2"');
  console.error('');
  console.error('Environment: GITHUB_TOKEN (required for API access)');
}

function parseArgs(): z.infer<typeof ArgsSchema> {
  const args: Record<string, string> = {};

  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(\w+)=(.*)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  }

  return ArgsSchema.parse(args);
}

async function main(): Promise<void> {
  let parsed: z.infer<typeof ArgsSchema>;

  try {
    parsed = parseArgs();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Error:', error.flatten().formErrors.join(', '));
    }
    printUsage();
    process.exit(1);
  }

  // Direct labels mode (bypass API)
  if (parsed.labels !== undefined) {
    console.log(parsed.labels);
    return;
  }

  // API mode - requires token
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const client = createGitHubClient(token);

  try {
    const { owner, repo, sha } = parsed as Required<Pick<typeof parsed, 'owner' | 'repo' | 'sha'>>;
    const labels = await withRetry(() => client.getPRLabels(owner, repo, sha));
    console.log(labels.join(','));
  } catch (error) {
    console.error('Error fetching PR labels:', error);
    process.exit(1);
  }
}

main();
