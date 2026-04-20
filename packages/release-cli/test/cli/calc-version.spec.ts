import { describe, expect, it } from 'bun:test';
import { $ } from 'bun';

const CLI_PATH = './src/cli/calc-version.ts';

describe('calc-version CLI', () => {
  describe('valid inputs', () => {
    it('calculates patch bump', async () => {
      const result = await $`bun ${CLI_PATH} 1.2.3 patch`.text();
      expect(result.trim()).toBe('1.2.4');
    });

    it('calculates minor bump', async () => {
      const result = await $`bun ${CLI_PATH} 1.2.3 minor`.text();
      expect(result.trim()).toBe('1.3.0');
    });

    it('calculates major bump', async () => {
      const result = await $`bun ${CLI_PATH} 1.2.3 major`.text();
      expect(result.trim()).toBe('2.0.0');
    });

    it('handles v prefix in input', async () => {
      const result = await $`bun ${CLI_PATH} v1.2.3 patch`.text();
      expect(result.trim()).toBe('1.2.4');
    });

    it('handles version 0.0.0', async () => {
      const result = await $`bun ${CLI_PATH} 0.0.0 patch`.text();
      expect(result.trim()).toBe('0.0.1');
    });

    it('outputs with v prefix when --with-prefix flag', async () => {
      const result = await $`bun ${CLI_PATH} 1.2.3 patch --with-prefix`.text();
      expect(result.trim()).toBe('v1.2.4');
    });
  });

  describe('invalid inputs', () => {
    it('fails with invalid version format', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH, 'invalid', 'patch'], {
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });

    it('fails with invalid release type', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH, '1.2.3', 'invalid'], {
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });

    it('fails with missing arguments', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH], {
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });

    it('fails with only one argument', async () => {
      const proc = Bun.spawn(['bun', CLI_PATH, '1.2.3'], {
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
    });
  });
});
