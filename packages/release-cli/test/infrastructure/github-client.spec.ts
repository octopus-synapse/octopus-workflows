import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { graphql } from '@octokit/graphql';
import {
  createGitHubClient,
  type GitHubClient,
} from '../../src/infrastructure/github-client';

describe('github-client', () => {
  let mockGraphql: ReturnType<typeof mock>;
  let client: GitHubClient;

  beforeEach(() => {
    mockGraphql = mock(() => Promise.resolve({}));
    client = createGitHubClient('test-token', mockGraphql as unknown as typeof graphql);
  });

  describe('getPRLabels', () => {
    it('returns labels from associated PR', async () => {
      mockGraphql.mockResolvedValueOnce({
        repository: {
          commit: {
            associatedPullRequests: {
              nodes: [
                {
                  number: 123,
                  merged: true,
                  labels: {
                    nodes: [{ name: 'patch' }, { name: 'bug' }],
                  },
                },
              ],
            },
          },
        },
      });

      const labels = await client.getPRLabels('owner', 'repo', 'abc123');

      expect(labels).toEqual(['patch', 'bug']);
    });

    it('returns empty array when no PR found', async () => {
      mockGraphql.mockResolvedValueOnce({
        repository: {
          commit: {
            associatedPullRequests: {
              nodes: [],
            },
          },
        },
      });

      const labels = await client.getPRLabels('owner', 'repo', 'abc123');

      expect(labels).toEqual([]);
    });

    it('returns empty array when PR has no labels', async () => {
      mockGraphql.mockResolvedValueOnce({
        repository: {
          commit: {
            associatedPullRequests: {
              nodes: [
                {
                  number: 123,
                  merged: true,
                  labels: { nodes: [] },
                },
              ],
            },
          },
        },
      });

      const labels = await client.getPRLabels('owner', 'repo', 'abc123');

      expect(labels).toEqual([]);
    });

    it('calls graphql with correct query', async () => {
      mockGraphql.mockResolvedValueOnce({
        repository: {
          commit: {
            associatedPullRequests: { nodes: [] },
          },
        },
      });

      await client.getPRLabels('myowner', 'myrepo', 'mysha');

      expect(mockGraphql).toHaveBeenCalledTimes(1);
      const [_query, variables] = mockGraphql.mock.calls[0];
      expect(variables).toEqual({
        owner: 'myowner',
        repo: 'myrepo',
        sha: 'mysha',
      });
    });
  });

  describe('getMergedPRs', () => {
    it('returns merged PRs', async () => {
      mockGraphql.mockResolvedValueOnce({
        repository: {
          pullRequests: {
            nodes: [
              {
                number: 1,
                title: 'feat: add feature',
                mergedAt: '2024-01-10T10:00:00Z',
              },
              {
                number: 2,
                title: 'fix: bug fix',
                mergedAt: '2024-01-11T10:00:00Z',
              },
            ],
          },
        },
      });

      const prs = await client.getMergedPRs('owner', 'repo', 'main');

      expect(prs).toHaveLength(2);
      expect(prs[0]).toEqual({
        number: 1,
        title: 'feat: add feature',
        mergedAt: '2024-01-10T10:00:00Z',
      });
    });

    it('returns empty array when no PRs', async () => {
      mockGraphql.mockResolvedValueOnce({
        repository: {
          pullRequests: { nodes: [] },
        },
      });

      const prs = await client.getMergedPRs('owner', 'repo', 'main');

      expect(prs).toEqual([]);
    });
  });

  describe('getPRBody', () => {
    it('returns PR body from associated PR', async () => {
      mockGraphql.mockResolvedValueOnce({
        repository: {
          commit: {
            associatedPullRequests: {
              nodes: [
                {
                  number: 123,
                  body: '## Summary\n\nThis is the PR body',
                },
              ],
            },
          },
        },
      });

      const body = await client.getPRBody('owner', 'repo', 'abc123');

      expect(body).toBe('## Summary\n\nThis is the PR body');
    });

    it('returns empty string when no PR found', async () => {
      mockGraphql.mockResolvedValueOnce({
        repository: {
          commit: {
            associatedPullRequests: { nodes: [] },
          },
        },
      });

      const body = await client.getPRBody('owner', 'repo', 'abc123');

      expect(body).toBe('');
    });
  });
});
