import { describe, expect, it } from 'bun:test';
import { $ } from 'bun';

const CLI_PATH = './src/cli/detect-release.ts';

describe('detect-release CLI', () => {
  describe('with labels argument', () => {
    it('detects patch from labels', async () => {
      const result = await $`bun ${CLI_PATH} --labels="patch,bug"`.text();
      expect(result.trim()).toBe('patch');
    });

    it('detects minor from labels', async () => {
      const result = await $`bun ${CLI_PATH} --labels="minor,feature"`.text();
      expect(result.trim()).toBe('minor');
    });

    it('detects major from labels', async () => {
      const result = await $`bun ${CLI_PATH} --labels="major,breaking"`.text();
      expect(result.trim()).toBe('major');
    });

    it('prioritizes major over minor', async () => {
      const result = await $`bun ${CLI_PATH} --labels="minor,major"`.text();
      expect(result.trim()).toBe('major');
    });

    it('prioritizes major over patch', async () => {
      const result = await $`bun ${CLI_PATH} --labels="patch,major"`.text();
      expect(result.trim()).toBe('major');
    });

    it('prioritizes minor over patch', async () => {
      const result = await $`bun ${CLI_PATH} --labels="patch,minor"`.text();
      expect(result.trim()).toBe('minor');
    });

    it('outputs empty for no release labels', async () => {
      const result = await $`bun ${CLI_PATH} --labels="bug,enhancement"`.text();
      expect(result.trim()).toBe('');
    });

    it('handles empty labels', async () => {
      const result = await $`bun ${CLI_PATH} --labels=""`.text();
      expect(result.trim()).toBe('');
    });
  });

  describe('with JSON input via stdin', () => {
    it('detects from JSON array of labels', async () => {
      const result = await $`echo '["feature", "minor"]' | bun ${CLI_PATH} --stdin`.text();
      expect(result.trim()).toBe('minor');
    });

    it('handles empty JSON array', async () => {
      const result = await $`echo '[]' | bun ${CLI_PATH} --stdin`.text();
      expect(result.trim()).toBe('');
    });
  });

  describe('error handling', () => {
    it('fails with invalid JSON in stdin mode', async () => {
      const proc = Bun.spawn(['bash', '-c', `echo 'not json' | bun ${CLI_PATH} --stdin`], {
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });

    it('fails with no input mode specified', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH], {
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });
  });
});
