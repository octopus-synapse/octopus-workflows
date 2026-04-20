import { beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  createGitTagsClient,
  filterTagsByType,
  type GitTagsClient,
  type Tag,
} from '../../src/infrastructure/git-tags';

describe('git-tags', () => {
  describe('filterTagsByType', () => {
    const allTags: Tag[] = [
      { name: 'v0.0.1', date: '2024-01-01T00:00:00Z' },
      { name: 'v0.0.2', date: '2024-01-02T00:00:00Z' },
      { name: 'v0.1.0', date: '2024-01-10T00:00:00Z' },
      { name: 'v0.1.1', date: '2024-01-11T00:00:00Z' },
      { name: 'v0.2.0', date: '2024-01-20T00:00:00Z' },
      { name: 'v1.0.0', date: '2024-02-01T00:00:00Z' },
      { name: 'v1.0.1', date: '2024-02-02T00:00:00Z' },
      { name: 'v1.1.0', date: '2024-02-10T00:00:00Z' },
    ];

    it('filters patch tags (non-.0 releases)', () => {
      const patches = filterTagsByType(allTags, 'patch');

      expect(patches.map((t) => t.name)).toEqual(['v0.0.1', 'v0.0.2', 'v0.1.1', 'v1.0.1']);
    });

    it('filters minor tags (v*.*.0 releases)', () => {
      const minors = filterTagsByType(allTags, 'minor');

      expect(minors.map((t) => t.name)).toEqual(['v0.1.0', 'v0.2.0', 'v1.1.0']);
    });

    it('filters major tags (v*.0.0 releases)', () => {
      const majors = filterTagsByType(allTags, 'major');

      expect(majors.map((t) => t.name)).toEqual(['v1.0.0']);
    });

    it('returns empty array for empty input', () => {
      expect(filterTagsByType([], 'patch')).toEqual([]);
      expect(filterTagsByType([], 'minor')).toEqual([]);
      expect(filterTagsByType([], 'major')).toEqual([]);
    });
  });

  describe('createGitTagsClient', () => {
    let mockExec: ReturnType<typeof mock>;
    let client: GitTagsClient;

    beforeEach(() => {
      mockExec = mock(() => Promise.resolve({ stdout: '', exitCode: 0 }));
      client = createGitTagsClient(mockExec);
    });

    describe('getAllTags', () => {
      it('returns parsed tags with dates', async () => {
        mockExec.mockResolvedValueOnce({
          stdout: 'v0.0.1\nv0.1.0\nv1.0.0\n',
          exitCode: 0,
        });

        // Mock getTagDate calls
        mockExec
          .mockResolvedValueOnce({
            stdout: '2024-01-01T00:00:00Z',
            exitCode: 0,
          })
          .mockResolvedValueOnce({
            stdout: '2024-01-10T00:00:00Z',
            exitCode: 0,
          })
          .mockResolvedValueOnce({
            stdout: '2024-02-01T00:00:00Z',
            exitCode: 0,
          });

        const tags = await client.getAllTags();

        expect(tags).toHaveLength(3);
        expect(tags[0].name).toBe('v0.0.1');
      });

      it('returns empty array when no tags', async () => {
        mockExec.mockResolvedValueOnce({ stdout: '', exitCode: 0 });

        const tags = await client.getAllTags();

        expect(tags).toEqual([]);
      });
    });

    describe('getBaseTag', () => {
      it('returns latest tag for patch release', async () => {
        // Mock simulates `head -1` returning only first line
        mockExec.mockResolvedValueOnce({
          stdout: 'v1.0.1',
          exitCode: 0,
        });

        const baseTag = await client.getBaseTag('patch');

        expect(baseTag).toBe('v1.0.1');
      });

      it('returns latest minor tag for minor release', async () => {
        // Mock simulates grep + head -1 returning only first matching line
        mockExec.mockResolvedValueOnce({
          stdout: 'v1.1.0',
          exitCode: 0,
        });

        const baseTag = await client.getBaseTag('minor');

        expect(baseTag).toBe('v1.1.0');
      });

      it('returns latest major tag for major release', async () => {
        // Mock simulates grep + head -1 returning only first matching line
        mockExec.mockResolvedValueOnce({
          stdout: 'v2.0.0',
          exitCode: 0,
        });

        const baseTag = await client.getBaseTag('major');

        expect(baseTag).toBe('v2.0.0');
      });

      it('returns null when no matching tag exists', async () => {
        mockExec.mockResolvedValueOnce({ stdout: '', exitCode: 0 });

        const baseTag = await client.getBaseTag('major');

        expect(baseTag).toBeNull();
      });
    });

    describe('getTagDate', () => {
      it('returns tag date in ISO format', async () => {
        mockExec.mockResolvedValueOnce({
          stdout: '2024-01-15T10:30:00Z\n',
          exitCode: 0,
        });

        const date = await client.getTagDate('v1.0.0');

        expect(date).toBe('2024-01-15T10:30:00Z');
      });

      it('returns fallback date on error', async () => {
        mockExec.mockResolvedValueOnce({
          stdout: '',
          exitCode: 1,
        });

        const date = await client.getTagDate('nonexistent');

        expect(date).toBe('2000-01-01T00:00:00Z');
      });
    });
  });
});
