import { describe, expect, it } from 'bun:test';
import { $ } from 'bun';

const CLI_PATH = './src/cli/gen-changelog.ts';

describe('gen-changelog CLI', () => {
  const basePRs = [
    { number: 1, title: 'feat: add login', mergedAt: '2024-01-10T10:00:00Z' },
    { number: 2, title: 'fix: auth bug', mergedAt: '2024-01-11T10:00:00Z' },
  ];

  describe('patch changelog', () => {
    it('generates simple list', async () => {
      const input = JSON.stringify({
        releaseType: 'patch',
        prs: basePRs,
        tags: [],
        baseDate: '2024-01-01T00:00:00Z',
        nextVersion: 'v0.0.1',
        repository: 'owner/repo',
      });

      const result = await $`echo ${input} | bun ${CLI_PATH}`.text();

      expect(result).toContain('### Changes');
      expect(result).toContain('- feat: add login #1');
      expect(result).toContain('- fix: auth bug #2');
      expect(result).toContain('**Full Changelog**');
    });
  });

  describe('minor changelog', () => {
    it('generates grouped by patches', async () => {
      const input = JSON.stringify({
        releaseType: 'minor',
        prs: [
          { number: 1, title: 'first', mergedAt: '2024-01-05T00:00:00Z' },
          { number: 2, title: 'second', mergedAt: '2024-01-15T00:00:00Z' },
        ],
        tags: [{ name: 'v0.0.1', date: '2024-01-10T00:00:00Z' }],
        baseDate: '2024-01-01T00:00:00Z',
        nextVersion: 'v0.1.0',
        repository: 'owner/repo',
      });

      const result = await $`echo ${input} | bun ${CLI_PATH}`.text();

      expect(result).toContain('### Changes since last minor release');
      expect(result).toContain('#### v0.0.1');
      expect(result).toContain('#### v0.1.0');
    });
  });

  describe('major changelog', () => {
    it('generates grouped by minors and patches', async () => {
      const input = JSON.stringify({
        releaseType: 'major',
        prs: [{ number: 1, title: 'initial', mergedAt: '2024-01-05T00:00:00Z' }],
        tags: [],
        minorTags: [],
        baseDate: '2024-01-01T00:00:00Z',
        nextVersion: 'v1.0.0',
        repository: 'owner/repo',
      });

      const result = await $`echo ${input} | bun ${CLI_PATH}`.text();

      expect(result).toContain('### Changes since last major release');
    });
  });

  describe('footer', () => {
    it('includes compare link with base tag', async () => {
      const input = JSON.stringify({
        releaseType: 'patch',
        prs: basePRs,
        tags: [],
        baseDate: '2024-01-01T00:00:00Z',
        baseTag: 'v0.0.1',
        nextVersion: 'v0.0.2',
        repository: 'owner/repo',
      });

      const result = await $`echo ${input} | bun ${CLI_PATH}`.text();

      expect(result).toContain('v0.0.1...v0.0.2');
    });

    it('uses v0.0.0 when no base tag', async () => {
      const input = JSON.stringify({
        releaseType: 'patch',
        prs: basePRs,
        tags: [],
        baseDate: '2024-01-01T00:00:00Z',
        nextVersion: 'v0.0.1',
        repository: 'owner/repo',
      });

      const result = await $`echo ${input} | bun ${CLI_PATH}`.text();

      expect(result).toContain('v0.0.0...v0.0.1');
    });
  });

  describe('error handling', () => {
    it('fails with invalid JSON', async () => {
      const proc = Bun.spawn(['bash', '-c', `echo 'not json' | bun ${CLI_PATH}`], {
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });

    it('fails with missing required fields', async () => {
      const proc = Bun.spawn(['bash', '-c', `echo '{}' | bun ${CLI_PATH}`], { stderr: 'pipe' });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });
  });
});
