/**
 * Infrastructure: GitHub Client
 *
 * GraphQL wrapper for GitHub API operations.
 * Uses dependency injection for testability.
 */

import { graphql } from '@octokit/graphql';

export type PullRequest = {
  number: number;
  title: string;
  mergedAt: string;
};

type GraphQLFn = typeof graphql;

const PR_LABELS_QUERY = `
  query($owner: String!, $repo: String!, $sha: String!) {
    repository(owner: $owner, name: $repo) {
      commit: object(expression: $sha) {
        ... on Commit {
          associatedPullRequests(first: 1) {
            nodes {
              number
              merged
              labels(first: 10) {
                nodes { name }
              }
            }
          }
        }
      }
    }
  }
`;

const MERGED_PRS_QUERY = `
  query($owner: String!, $repo: String!, $base: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        first: 100
        states: MERGED
        baseRefName: $base
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        nodes {
          number
          title
          mergedAt
        }
      }
    }
  }
`;

const PR_BODY_QUERY = `
  query($owner: String!, $repo: String!, $sha: String!) {
    repository(owner: $owner, name: $repo) {
      commit: object(expression: $sha) {
        ... on Commit {
          associatedPullRequests(first: 1) {
            nodes {
              number
              body
            }
          }
        }
      }
    }
  }
`;

export type GitHubClient = ReturnType<typeof createGitHubClient>;

/**
 * Creates a GitHub client with the provided token.
 * Accepts an optional graphql function for testing.
 */
export function createGitHubClient(token: string, gql?: GraphQLFn) {
  const client =
    gql ??
    graphql.defaults({
      headers: { authorization: `token ${token}` },
    });

  return {
    /**
     * Gets PR labels for a commit SHA.
     */
    async getPRLabels(owner: string, repo: string, sha: string): Promise<string[]> {
      const response = (await client(PR_LABELS_QUERY, {
        owner,
        repo,
        sha,
      })) as {
        repository: {
          commit: {
            associatedPullRequests: {
              nodes: Array<{
                number: number;
                merged: boolean;
                labels: { nodes: Array<{ name: string }> };
              }>;
            };
          };
        };
      };

      const pr = response.repository.commit.associatedPullRequests.nodes[0];
      if (!pr) return [];

      return pr.labels.nodes.map((l) => l.name);
    },

    /**
     * Gets merged PRs for a base branch.
     */
    async getMergedPRs(owner: string, repo: string, base: string): Promise<PullRequest[]> {
      const response = (await client(MERGED_PRS_QUERY, {
        owner,
        repo,
        base,
      })) as {
        repository: {
          pullRequests: {
            nodes: Array<{
              number: number;
              title: string;
              mergedAt: string;
            }>;
          };
        };
      };

      return response.repository.pullRequests.nodes.map((pr) => ({
        number: pr.number,
        title: pr.title,
        mergedAt: pr.mergedAt,
      }));
    },

    /**
     * Gets PR body for a commit SHA.
     */
    async getPRBody(owner: string, repo: string, sha: string): Promise<string> {
      const response = (await client(PR_BODY_QUERY, {
        owner,
        repo,
        sha,
      })) as {
        repository: {
          commit: {
            associatedPullRequests: {
              nodes: Array<{
                number: number;
                body: string;
              }>;
            };
          };
        };
      };

      const pr = response.repository.commit.associatedPullRequests.nodes[0];
      return pr?.body ?? '';
    },
  };
}
