#!/usr/bin/env bun
/**
 * CLI: Gather Changelog Data
 *
 * Gathers all data needed for changelog generation.
 * Outputs JSON suitable for gen-changelog.ts
 *
 * Usage:
 *   bun gather-changelog-data.ts \
 *     --release-type=patch \
 *     --next-version=v1.2.4 \
 *     --repository=owner/repo
 *
 * Environment:
 *   GITHUB_TOKEN - Required for API access (not needed with --mock-data)
 *
 * Output:
 *   JSON object with prs, tags, baseDate, etc.
 */

import { z } from 'zod';
import { createGitTagsClient, filterTagsByType, type Tag } from '../infrastructure/git-tags';
import { createGitHubClient } from '../infrastructure/github-client';

const ArgsSchema = z.object({
  releaseType: z.enum(['major', 'minor', 'patch']),
  nextVersion: z.string().regex(/^v?\d+\.\d+\.\d+$/, 'Invalid semver'),
  repository: z.string().regex(/^[\w-]+\/[\w-]+$/, 'Invalid repository format'),
  mockData: z.boolean().default(false),
});

function printUsage(): void {
  console.error(
    'Usage: gather-changelog-data --release-type=<type> --next-version=<version> --repository=<owner/repo>',
  );
  console.error('');
  console.error('Options:');
  console.error('  --release-type   major, minor, or patch');
  console.error('  --next-version   Next version (e.g., v1.2.3)');
  console.error('  --repository     GitHub repository (e.g., owner/repo)');
  console.error('  --mock-data      Output mock data for testing');
  console.error('');
  console.error('Environment: GITHUB_TOKEN (required for API access)');
}

function parseArgs(): z.infer<typeof ArgsSchema> {
  const args: Record<string, string | boolean> = {};

  for (const arg of process.argv.slice(2)) {
    if (arg === '--mock-data') {
      args.mockData = true;
      continue;
    }

    const match = arg.match(/^--(\w+(?:-\w+)*)=(.*)$/);
    if (match) {
      // Convert kebab-case to camelCase
      const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = match[2];
    }
  }

  return ArgsSchema.parse(args);
}

function getMockData(releaseType: string, nextVersion: string, repository: string) {
  const basePrs = [
    {
      number: 1,
      title: 'feat: mock feature',
      mergedAt: '2024-01-10T10:00:00Z',
    },
    { number: 2, title: 'fix: mock fix', mergedAt: '2024-01-11T10:00:00Z' },
  ];

  const baseTags: Tag[] = [
    { name: 'v0.0.1', date: '2024-01-05T00:00:00Z' },
    { name: 'v0.1.0', date: '2024-01-15T00:00:00Z' },
  ];

  return {
    releaseType,
    prs: basePrs,
    tags: releaseType === 'patch' ? [] : baseTags,
    minorTags: releaseType === 'major' ? [baseTags[1]] : undefined,
    baseDate: '2024-01-01T00:00:00Z',
    baseTag: 'v0.0.1',
    nextVersion,
    repository,
  };
}

async function main(): Promise<void> {
  let parsed: z.infer<typeof ArgsSchema>;

  try {
    parsed = parseArgs();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Error:', JSON.stringify(error.flatten().fieldErrors));
    }
    printUsage();
    process.exit(1);
  }

  const { releaseType, nextVersion, repository, mockData } = parsed;

  // Mock mode for testing
  if (mockData) {
    console.log(JSON.stringify(getMockData(releaseType, nextVersion, repository)));
    return;
  }

  // API mode - requires token
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const [owner, repo] = repository.split('/');
  const githubClient = createGitHubClient(token);
  const gitTagsClient = createGitTagsClient();

  try {
    // Get base tag
    const baseTag = await gitTagsClient.getBaseTag(releaseType);
    const baseDate = baseTag ? await gitTagsClient.getTagDate(baseTag) : '2000-01-01T00:00:00Z';

    // Get PRs from both main and homolog
    const [prsMain, prsHomolog] = await Promise.all([
      githubClient.getMergedPRs(owner, repo, 'main'),
      githubClient.getMergedPRs(owner, repo, 'homolog'),
    ]);

    // Merge and deduplicate PRs
    const allPrs = [...prsMain, ...prsHomolog];
    const uniquePrs = Array.from(new Map(allPrs.map((pr) => [pr.number, pr])).values()).sort(
      (a, b) => a.mergedAt.localeCompare(b.mergedAt),
    );

    // Get all tags
    const allTags = await gitTagsClient.getAllTags();

    // Filter tags based on release type
    let tags: Tag[] = [];
    let minorTags: Tag[] | undefined;

    if (releaseType === 'minor' || releaseType === 'major') {
      tags = allTags;
    }

    if (releaseType === 'major') {
      minorTags = filterTagsByType(allTags, 'minor');
    }

    const output = {
      releaseType,
      prs: uniquePrs,
      tags,
      ...(minorTags && { minorTags }),
      baseDate,
      baseTag,
      nextVersion,
      repository,
    };

    console.log(JSON.stringify(output));
  } catch (error) {
    console.error('Error gathering changelog data:', error);
    process.exit(1);
  }
}

main();
