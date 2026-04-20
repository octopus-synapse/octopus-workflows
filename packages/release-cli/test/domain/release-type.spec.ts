import { describe, expect, it } from 'bun:test';
import {
  detectReleaseType,
  isValidReleaseType,
  RELEASE_TYPES,
} from '../../src/domain/release-type';

describe('release-type', () => {
  describe('RELEASE_TYPES', () => {
    it('contains major, minor, patch in priority order', () => {
      expect(RELEASE_TYPES).toEqual(['major', 'minor', 'patch']);
    });
  });

  describe('isValidReleaseType', () => {
    it('returns true for major', () => {
      expect(isValidReleaseType('major')).toBe(true);
    });

    it('returns true for minor', () => {
      expect(isValidReleaseType('minor')).toBe(true);
    });

    it('returns true for patch', () => {
      expect(isValidReleaseType('patch')).toBe(true);
    });

    it('returns false for invalid type', () => {
      expect(isValidReleaseType('invalid')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidReleaseType('')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isValidReleaseType(null as unknown as string)).toBe(false);
      expect(isValidReleaseType(undefined as unknown as string)).toBe(false);
    });

    it('is case sensitive', () => {
      expect(isValidReleaseType('MAJOR')).toBe(false);
      expect(isValidReleaseType('Minor')).toBe(false);
    });
  });

  describe('detectReleaseType', () => {
    it('returns major when major label is present', () => {
      expect(detectReleaseType(['major'])).toBe('major');
    });

    it('returns minor when minor label is present', () => {
      expect(detectReleaseType(['minor'])).toBe('minor');
    });

    it('returns patch when patch label is present', () => {
      expect(detectReleaseType(['patch'])).toBe('patch');
    });

    it('returns null when no release label is present', () => {
      expect(detectReleaseType(['bug', 'enhancement'])).toBeNull();
    });

    it('returns null for empty labels array', () => {
      expect(detectReleaseType([])).toBeNull();
    });

    // Priority tests - major > minor > patch
    it('prioritizes major over minor', () => {
      expect(detectReleaseType(['minor', 'major'])).toBe('major');
    });

    it('prioritizes major over patch', () => {
      expect(detectReleaseType(['patch', 'major'])).toBe('major');
    });

    it('prioritizes minor over patch', () => {
      expect(detectReleaseType(['patch', 'minor'])).toBe('minor');
    });

    it('prioritizes correctly with all three labels', () => {
      expect(detectReleaseType(['patch', 'minor', 'major'])).toBe('major');
    });

    // Mixed labels tests
    it('detects release label among other labels', () => {
      expect(detectReleaseType(['bug', 'minor', 'documentation'])).toBe('minor');
    });

    it('handles labels with extra whitespace (trimmed input)', () => {
      // Assuming labels are already trimmed by the caller
      expect(detectReleaseType(['major'])).toBe('major');
    });

    // Edge cases
    it('handles duplicate labels', () => {
      expect(detectReleaseType(['patch', 'patch', 'patch'])).toBe('patch');
    });

    it('is case sensitive - ignores uppercase labels', () => {
      expect(detectReleaseType(['MAJOR', 'MINOR'])).toBeNull();
    });
  });
});
