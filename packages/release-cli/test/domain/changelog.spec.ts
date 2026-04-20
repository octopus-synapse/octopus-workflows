import { describe, expect, it } from 'bun:test';
import {
  formatChangelogFooter,
  formatMajorChangelog,
  formatMinorChangelog,
  formatPatchChangelog,
  type PullRequest,
  type Tag,
} from '../../src/domain/changelog';

describe('changelog', () => {
  const basePRs: PullRequest[] = [
    { number: 1, title: 'feat: add login', mergedAt: '2024-01-10T10:00:00Z' },
    { number: 2, title: 'fix: auth bug', mergedAt: '2024-01-11T10:00:00Z' },
    { number: 3, title: 'docs: readme', mergedAt: '2024-01-12T10:00:00Z' },
  ];

  describe('formatPatchChangelog', () => {
    it('formats simple list of PRs', () => {
      const result = formatPatchChangelog(basePRs);

      expect(result).toContain('### Changes');
      expect(result).toContain('- feat: add login #1');
      expect(result).toContain('- fix: auth bug #2');
      expect(result).toContain('- docs: readme #3');
    });

    it('returns header with empty list for no PRs', () => {
      const result = formatPatchChangelog([]);
      expect(result).toContain('### Changes');
      expect(result.split('\n').filter((l) => l.startsWith('-')).length).toBe(0);
    });

    it('preserves PR order', () => {
      const result = formatPatchChangelog(basePRs);
      const lines = result.split('\n').filter((l) => l.startsWith('-'));

      expect(lines[0]).toContain('#1');
      expect(lines[1]).toContain('#2');
      expect(lines[2]).toContain('#3');
    });

    it('filters PRs merged before baseDate', () => {
      // Regression: gather-changelog-data ships every PR merged on main +
      // homolog without a date filter. If formatPatchChangelog doesn't honor
      // baseDate, every patch release regurgitates the entire repo history
      // (the bug that produced the 100-entry changelog on profile-services
      // PR #218 / v0.2.3).
      const result = formatPatchChangelog(basePRs, '2024-01-10T23:00:00Z');
      const lines = result.split('\n').filter((l) => l.startsWith('-'));

      expect(lines.length).toBe(2);
      expect(result).not.toContain('#1');
      expect(result).toContain('#2');
      expect(result).toContain('#3');
    });

    it('is inclusive of baseDate (strict >)', () => {
      // baseDate is the last release tag's date. A PR merged at that exact
      // instant was already included in the previous release, so the new
      // changelog must start strictly after it.
      const result = formatPatchChangelog(basePRs, '2024-01-11T10:00:00Z');
      const lines = result.split('\n').filter((l) => l.startsWith('-'));

      expect(lines.length).toBe(1);
      expect(result).toContain('#3');
    });
  });

  describe('formatMinorChangelog', () => {
    const patchTags: Tag[] = [
      { name: 'v0.0.1', date: '2024-01-10T12:00:00Z' },
      { name: 'v0.0.2', date: '2024-01-11T12:00:00Z' },
    ];

    it('groups PRs by patch releases', () => {
      const prs: PullRequest[] = [
        {
          number: 1,
          title: 'feat: feature 1',
          mergedAt: '2024-01-10T10:00:00Z',
        },
        {
          number: 2,
          title: 'feat: feature 2',
          mergedAt: '2024-01-11T10:00:00Z',
        },
        {
          number: 3,
          title: 'feat: feature 3',
          mergedAt: '2024-01-12T10:00:00Z',
        },
      ];

      const result = formatMinorChangelog(prs, patchTags, '2024-01-01T00:00:00Z', 'v0.1.0');

      expect(result).toContain('### Changes since last minor release');
      expect(result).toContain('#### v0.0.1');
      expect(result).toContain('#### v0.0.2');
    });

    it('includes current release section for PRs after last tag', () => {
      const prs: PullRequest[] = [
        { number: 5, title: 'latest change', mergedAt: '2024-01-15T10:00:00Z' },
      ];

      const result = formatMinorChangelog(prs, patchTags, '2024-01-01T00:00:00Z', 'v0.1.0');

      expect(result).toContain('#### v0.1.0');
      expect(result).toContain('- latest change #5');
    });

    it('handles empty tags list', () => {
      const result = formatMinorChangelog(basePRs, [], '2024-01-01T00:00:00Z', 'v0.1.0');

      expect(result).toContain('#### v0.1.0');
    });
  });

  describe('formatMajorChangelog', () => {
    const minorTags: Tag[] = [{ name: 'v0.1.0', date: '2024-01-15T00:00:00Z' }];

    const patchTags: Tag[] = [
      { name: 'v0.0.1', date: '2024-01-05T00:00:00Z' },
      { name: 'v0.0.2', date: '2024-01-10T00:00:00Z' },
    ];

    it('groups by minor, then patch', () => {
      const prs: PullRequest[] = [
        { number: 1, title: 'initial', mergedAt: '2024-01-04T00:00:00Z' },
        { number: 2, title: 'patch 1', mergedAt: '2024-01-06T00:00:00Z' },
        { number: 3, title: 'patch 2', mergedAt: '2024-01-11T00:00:00Z' },
      ];

      const result = formatMajorChangelog(
        prs,
        minorTags,
        patchTags,
        '2024-01-01T00:00:00Z',
        'v1.0.0',
      );

      expect(result).toContain('### Changes since last major release');
    });

    it('includes current release section', () => {
      const prs: PullRequest[] = [
        { number: 10, title: 'new feature', mergedAt: '2024-01-20T00:00:00Z' },
      ];

      const result = formatMajorChangelog(
        prs,
        minorTags,
        patchTags,
        '2024-01-01T00:00:00Z',
        'v1.0.0',
      );

      expect(result).toContain('### v1.0.0');
    });
  });

  describe('formatChangelogFooter', () => {
    it('formats footer with full changelog link', () => {
      const result = formatChangelogFooter('owner/repo', 'v0.0.1', 'v0.0.2');

      expect(result).toContain('**Full Changelog**');
      expect(result).toContain('owner/repo');
      expect(result).toContain('v0.0.1...v0.0.2');
    });

    it('handles first release with no base tag', () => {
      const result = formatChangelogFooter('owner/repo', null, 'v0.0.1');

      expect(result).toContain('v0.0.0...v0.0.1');
    });
  });
});
