/**
 * Domain: Version
 *
 * Pure functions for semantic versioning operations.
 * No side effects, no external dependencies.
 */

import { type ReleaseType } from './release-type';

export type Version = {
  major: number;
  minor: number;
  patch: number;
};

const SEMVER_REGEX = /^v?(\d+)\.(\d+)\.(\d+)$/;

/**
 * Parses a semver string into a Version object.
 *
 * @param version - Semver string (e.g., "1.2.3" or "v1.2.3")
 * @returns Version object
 * @throws Error if format is invalid
 */
export function parseVersion(version: string): Version {
  const match = version.match(SEMVER_REGEX);

  if (!match) {
    throw new Error(`Invalid version format: "${version}"`);
  }

  const [, majorStr, minorStr, patchStr] = match;
  const major = parseInt(majorStr, 10);
  const minor = parseInt(minorStr, 10);
  const patch = parseInt(patchStr, 10);

  if (major < 0 || minor < 0 || patch < 0) {
    throw new Error(`Invalid version format: "${version}"`);
  }

  return { major, minor, patch };
}

/**
 * Calculates the next version based on release type.
 *
 * - patch: 1.2.3 → 1.2.4
 * - minor: 1.2.3 → 1.3.0
 * - major: 1.2.3 → 2.0.0
 */
export function calculateNextVersion(current: Version, type: ReleaseType): Version {
  switch (type) {
    case 'patch':
      return { ...current, patch: current.patch + 1 };
    case 'minor':
      return { ...current, minor: current.minor + 1, patch: 0 };
    case 'major':
      return { major: current.major + 1, minor: 0, patch: 0 };
  }
}

/**
 * Formats a Version object into a semver string.
 */
export function formatVersion(version: Version): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Formats a Version object with v prefix.
 */
export function formatVersionWithPrefix(version: Version): string {
  return `v${formatVersion(version)}`;
}

/**
 * Compares two versions.
 *
 * @returns Positive if a > b, negative if a < b, zero if equal
 */
export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  return a.patch - b.patch;
}
