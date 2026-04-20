import { describe, expect, it } from 'bun:test';
import {
  calculateNextVersion,
  compareVersions,
  formatVersion,
  formatVersionWithPrefix,
  parseVersion,
  type Version,
} from '../../src/domain/version';

describe('version', () => {
  describe('parseVersion', () => {
    it('parses valid semver without prefix', () => {
      expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('parses valid semver with v prefix', () => {
      expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it('parses version 0.0.0', () => {
      expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
    });

    it('parses large version numbers', () => {
      expect(parseVersion('v123.456.789')).toEqual({ major: 123, minor: 456, patch: 789 });
    });

    it('throws on invalid format - no dots', () => {
      expect(() => parseVersion('123')).toThrow('Invalid version format');
    });

    it('throws on invalid format - letters', () => {
      expect(() => parseVersion('v1.2.abc')).toThrow('Invalid version format');
    });

    it('throws on invalid format - empty string', () => {
      expect(() => parseVersion('')).toThrow('Invalid version format');
    });

    it('throws on invalid format - too many parts', () => {
      expect(() => parseVersion('1.2.3.4')).toThrow('Invalid version format');
    });

    it('throws on invalid format - negative numbers', () => {
      expect(() => parseVersion('1.-2.3')).toThrow('Invalid version format');
    });
  });

  describe('calculateNextVersion', () => {
    const base: Version = { major: 1, minor: 2, patch: 3 };

    it('bumps patch version', () => {
      expect(calculateNextVersion(base, 'patch')).toEqual({ major: 1, minor: 2, patch: 4 });
    });

    it('bumps minor version and resets patch', () => {
      expect(calculateNextVersion(base, 'minor')).toEqual({ major: 1, minor: 3, patch: 0 });
    });

    it('bumps major version and resets minor and patch', () => {
      expect(calculateNextVersion(base, 'major')).toEqual({ major: 2, minor: 0, patch: 0 });
    });

    it('handles version 0.0.0', () => {
      const zero: Version = { major: 0, minor: 0, patch: 0 };
      expect(calculateNextVersion(zero, 'patch')).toEqual({ major: 0, minor: 0, patch: 1 });
      expect(calculateNextVersion(zero, 'minor')).toEqual({ major: 0, minor: 1, patch: 0 });
      expect(calculateNextVersion(zero, 'major')).toEqual({ major: 1, minor: 0, patch: 0 });
    });
  });

  describe('formatVersion', () => {
    it('formats version without prefix', () => {
      expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
    });

    it('formats version with v prefix', () => {
      expect(formatVersionWithPrefix({ major: 1, minor: 2, patch: 3 })).toBe('v1.2.3');
    });

    it('formats zero version', () => {
      expect(formatVersion({ major: 0, minor: 0, patch: 0 })).toBe('0.0.0');
    });
  });

  describe('compareVersions', () => {
    it('returns 0 for equal versions', () => {
      expect(
        compareVersions({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 2, patch: 3 }),
      ).toBe(0);
    });

    it('returns positive when first is greater (major)', () => {
      expect(
        compareVersions({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 9, patch: 9 }),
      ).toBeGreaterThan(0);
    });

    it('returns positive when first is greater (minor)', () => {
      expect(
        compareVersions({ major: 1, minor: 3, patch: 0 }, { major: 1, minor: 2, patch: 9 }),
      ).toBeGreaterThan(0);
    });

    it('returns positive when first is greater (patch)', () => {
      expect(
        compareVersions({ major: 1, minor: 2, patch: 4 }, { major: 1, minor: 2, patch: 3 }),
      ).toBeGreaterThan(0);
    });

    it('returns negative when first is smaller', () => {
      expect(
        compareVersions({ major: 1, minor: 2, patch: 3 }, { major: 1, minor: 2, patch: 4 }),
      ).toBeLessThan(0);
    });
  });
});
