import { describe, expect, it } from 'bun:test';
import { $ } from 'bun';

const CLI_PATH = './src/cli/gather-changelog-data.ts';

describe('gather-changelog-data CLI', () => {
  describe('argument parsing', () => {
    it('fails without required arguments', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH], {
        stderr: 'pipe',
        env: { ...process.env, GITHUB_TOKEN: 'test-token' },
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });

    it('fails without --release-type', async () => {
      const proc = Bun.spawn(
        ['bun', CLI_PATH, '--next-version=v1.0.0', '--repository=owner/repo'],
        {
          stderr: 'pipe',
          env: { ...process.env, GITHUB_TOKEN: 'test-token' },
        },
      );
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });

    it('fails with invalid release type', async () => {
      const proc = Bun.spawn(
        [
          'bun',
          CLI_PATH,
          '--release-type=invalid',
          '--next-version=v1.0.0',
          '--repository=owner/repo',
        ],
        {
          stderr: 'pipe',
          env: { ...process.env, GITHUB_TOKEN: 'test-token' },
        },
      );
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });
  });

  describe('with --mock-data flag (bypass API)', () => {
    it('outputs valid JSON structure for patch release', async () => {
      const result = await $`bun ${CLI_PATH} \
        --release-type=patch \
        --next-version=v1.0.1 \
        --repository=owner/repo \
        --mock-data`.text();

      const data = JSON.parse(result);

      expect(data.releaseType).toBe('patch');
      expect(data.nextVersion).toBe('v1.0.1');
      expect(data.repository).toBe('owner/repo');
      expect(Array.isArray(data.prs)).toBe(true);
      expect(Array.isArray(data.tags)).toBe(true);
    });

    it('outputs valid JSON structure for minor release', async () => {
      const result = await $`bun ${CLI_PATH} \
        --release-type=minor \
        --next-version=v1.1.0 \
        --repository=owner/repo \
        --mock-data`.text();

      const data = JSON.parse(result);

      expect(data.releaseType).toBe('minor');
      expect(data.nextVersion).toBe('v1.1.0');
    });

    it('outputs valid JSON structure for major release', async () => {
      const result = await $`bun ${CLI_PATH} \
        --release-type=major \
        --next-version=v2.0.0 \
        --repository=owner/repo \
        --mock-data`.text();

      const data = JSON.parse(result);

      expect(data.releaseType).toBe('major');
      expect(data.nextVersion).toBe('v2.0.0');
      expect(Array.isArray(data.minorTags)).toBe(true);
    });

    it('includes baseDate field', async () => {
      const result = await $`bun ${CLI_PATH} \
        --release-type=patch \
        --next-version=v1.0.1 \
        --repository=owner/repo \
        --mock-data`.text();

      const data = JSON.parse(result);

      expect(data.baseDate).toBeDefined();
      expect(typeof data.baseDate).toBe('string');
    });
  });
});
