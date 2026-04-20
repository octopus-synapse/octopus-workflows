import { describe, expect, it } from 'bun:test';
import { $ } from 'bun';

const CLI_PATH = './src/cli/get-pr-labels.ts';

// Note: These tests require GITHUB_TOKEN to be set, but we mock it for unit tests
// Integration tests would need a real token

describe('get-pr-labels CLI', () => {
  describe('argument parsing', () => {
    it('fails without required arguments', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH], {
        stderr: 'pipe',
        env: { ...process.env, GITHUB_TOKEN: 'test-token' },
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });

    it('fails without --sha argument', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH, '--owner=owner', '--repo=repo'], {
        stderr: 'pipe',
        env: { ...process.env, GITHUB_TOKEN: 'test-token' },
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });

    it('fails without GITHUB_TOKEN', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH, '--sha=abc123', '--owner=owner', '--repo=repo'], {
        stderr: 'pipe',
        env: { ...process.env, GITHUB_TOKEN: undefined },
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });
  });

  describe('with --labels flag (bypass API)', () => {
    it('outputs labels directly when provided', async () => {
      const result = await $`bun ${CLI_PATH} --labels="patch,bug,enhancement"`.text();

      expect(result.trim()).toBe('patch,bug,enhancement');
    });

    it('outputs empty string for empty labels', async () => {
      const result = await $`bun ${CLI_PATH} --labels=""`.text();

      expect(result.trim()).toBe('');
    });
  });
});
