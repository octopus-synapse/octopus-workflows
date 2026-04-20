/**
 * Release Module
 *
 * TypeScript utilities for semantic versioning and changelog generation.
 * Used by GitHub Actions workflows for automated releases.
 */

export {
  formatChangelogFooter,
  formatMajorChangelog,
  formatMinorChangelog,
  formatPatchChangelog,
  type PullRequest,
  type Tag,
} from './domain/changelog';

export {
  detectReleaseType,
  isValidReleaseType,
  RELEASE_TYPES,
  type ReleaseType,
} from './domain/release-type';
// Domain exports
export {
  calculateNextVersion,
  compareVersions,
  formatVersion,
  formatVersionWithPrefix,
  parseVersion,
  type Version,
} from './domain/version';
