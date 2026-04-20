/**
 * Domain: Release Type
 *
 * Pure functions for release type detection and validation.
 * Priority: major > minor > patch
 */

export type ReleaseType = 'major' | 'minor' | 'patch';

/**
 * Release types in priority order (highest to lowest).
 */
export const RELEASE_TYPES: readonly ReleaseType[] = ['major', 'minor', 'patch'] as const;

/**
 * Type guard to check if a string is a valid release type.
 */
export function isValidReleaseType(value: unknown): value is ReleaseType {
  if (typeof value !== 'string') {
    return false;
  }
  return RELEASE_TYPES.includes(value as ReleaseType);
}

/**
 * Detects the release type from PR labels.
 *
 * Priority: major > minor > patch
 * Returns null if no release label is found.
 *
 * @param labels - Array of label names from PR
 * @returns The highest priority release type found, or null
 */
export function detectReleaseType(labels: string[]): ReleaseType | null {
  for (const type of RELEASE_TYPES) {
    if (labels.includes(type)) {
      return type;
    }
  }
  return null;
}
