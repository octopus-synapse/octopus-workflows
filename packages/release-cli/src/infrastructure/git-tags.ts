/**
 * Infrastructure: Git Tags
 *
 * Operations for working with git tags.
 * Uses dependency injection for testability.
 */

import { $ } from 'bun';
import { type ReleaseType } from '../domain/release-type';

export type Tag = {
  name: string;
  date: string; // ISO 8601
};

type ExecFn = (cmd: string) => Promise<{ stdout: string; exitCode: number | null }>;

const DEFAULT_DATE = '2000-01-01T00:00:00Z';

/**
 * Filters tags by release type.
 *
 * - patch: non-.0 releases (v1.2.3 where patch != 0)
 * - minor: v*.*.0 releases (v1.2.0 where patch == 0 and minor != 0)
 * - major: v*.0.0 releases (v1.0.0 where minor == 0 and patch == 0)
 */
export function filterTagsByType(tags: Tag[], type: ReleaseType): Tag[] {
  return tags.filter((tag) => {
    const match = tag.name.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return false;

    const [, , minor, patch] = match.map(Number);

    switch (type) {
      case 'patch':
        return patch !== 0;
      case 'minor':
        return patch === 0 && minor !== 0;
      case 'major':
        return patch === 0 && minor === 0;
      default:
        return false;
    }
  });
}

export type GitTagsClient = ReturnType<typeof createGitTagsClient>;

/**
 * Creates a git tags client.
 * Accepts an optional exec function for testing.
 */
export function createGitTagsClient(exec?: ExecFn) {
  const runCmd =
    exec ??
    (async (cmd: string) => {
      const result = await $`sh -c ${cmd}`.quiet();
      return { stdout: result.stdout.toString(), exitCode: result.exitCode };
    });

  const getTagDate = async (tag: string): Promise<string> => {
    // Try tagger date first (annotated tag)
    const taggerResult = await runCmd(
      `git for-each-ref --format='%(taggerdate:iso8601-strict)' "refs/tags/${tag}"`,
    );

    if (taggerResult.exitCode === 0 && taggerResult.stdout.trim()) {
      return taggerResult.stdout.trim();
    }

    // Fallback to commit date
    const commitResult = await runCmd(`TZ=UTC git log -1 --format='%aI' "${tag}"`);

    if (commitResult.exitCode === 0 && commitResult.stdout.trim()) {
      return commitResult.stdout.trim();
    }

    return DEFAULT_DATE;
  };

  return {
    /**
     * Gets all version tags sorted by version.
     */
    async getAllTags(): Promise<Tag[]> {
      const result = await runCmd("git tag -l 'v*' --sort=v:refname");

      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return [];
      }

      const tagNames = result.stdout.trim().split('\n').filter(Boolean);
      const tags: Tag[] = [];

      for (const name of tagNames) {
        const date = await getTagDate(name);
        tags.push({ name, date });
      }

      return tags;
    },

    /**
     * Gets the base tag for a release type.
     * Returns the most recent tag that matches the type.
     */
    async getBaseTag(type: ReleaseType): Promise<string | null> {
      let pattern: string;

      switch (type) {
        case 'patch':
          // Most recent tag of any type
          pattern = "git tag -l 'v*' --sort=-v:refname | head -1";
          break;
        case 'minor':
          // Most recent v*.*.0 tag
          pattern =
            "git tag -l 'v*' --sort=-v:refname | grep -E '^v[0-9]+\\.[0-9]+\\.0$' | head -1";
          break;
        case 'major':
          // Most recent v*.0.0 tag
          pattern = "git tag -l 'v*' --sort=-v:refname | grep -E '^v[0-9]+\\.0\\.0$' | head -1";
          break;
      }

      const result = await runCmd(pattern);

      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return null;
      }

      return result.stdout.trim();
    },

    /**
     * Gets the date of a tag in ISO 8601 format.
     */
    getTagDate,
  };
}

/**
 * Default client using actual shell commands.
 */
export const gitTags = createGitTagsClient();
