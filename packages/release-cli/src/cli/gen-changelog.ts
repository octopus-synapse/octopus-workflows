#!/usr/bin/env bun
/**
 * CLI: Generate Changelog
 *
 * Reads JSON from stdin with PR and tag data, outputs formatted changelog.
 *
 * Usage:
 *   echo '<json>' | bun gen-changelog.ts
 *
 * Input JSON schema:
 *   {
 *     "releaseType": "patch" | "minor" | "major",
 *     "prs": [{ "number": 1, "title": "...", "mergedAt": "ISO date" }],
 *     "tags": [{ "name": "v0.0.1", "date": "ISO date" }],
 *     "minorTags": [{ "name": "v0.1.0", "date": "ISO date" }],  // for major
 *     "baseDate": "ISO date",
 *     "baseTag": "v0.0.0" | null,
 *     "nextVersion": "v0.0.1",
 *     "repository": "owner/repo"
 *   }
 */

import { z } from 'zod';
import {
  formatChangelogFooter,
  formatMajorChangelog,
  formatMinorChangelog,
  formatPatchChangelog,
  type PullRequest,
  type Tag,
} from '../domain/changelog';

const PullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  mergedAt: z.string(),
});

const TagSchema = z.object({
  name: z.string(),
  date: z.string(),
});

const InputSchema = z.object({
  releaseType: z.enum(['patch', 'minor', 'major']),
  prs: z.array(PullRequestSchema),
  tags: z.array(TagSchema).default([]),
  minorTags: z.array(TagSchema).optional(),
  baseDate: z.string(),
  baseTag: z.string().nullable().optional(),
  nextVersion: z.string(),
  repository: z.string(),
});

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main(): Promise<void> {
  try {
    const rawInput = await readStdin();
    const jsonInput = JSON.parse(rawInput.trim());
    const input = InputSchema.parse(jsonInput);

    let changelog: string;

    switch (input.releaseType) {
      case 'patch':
        changelog = formatPatchChangelog(input.prs as PullRequest[], input.baseDate);
        break;

      case 'minor':
        changelog = formatMinorChangelog(
          input.prs as PullRequest[],
          input.tags as Tag[],
          input.baseDate,
          input.nextVersion,
        );
        break;

      case 'major':
        changelog = formatMajorChangelog(
          input.prs as PullRequest[],
          (input.minorTags ?? []) as Tag[],
          input.tags as Tag[],
          input.baseDate,
          input.nextVersion,
        );
        break;
    }

    const footer = formatChangelogFooter(
      input.repository,
      input.baseTag ?? null,
      input.nextVersion,
    );

    console.log(changelog);
    console.log(footer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.flatten().fieldErrors);
    } else if (error instanceof SyntaxError) {
      console.error('Invalid JSON input');
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  }
}

main();
