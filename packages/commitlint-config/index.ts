import type { UserConfig } from '@commitlint/types';

/**
 * Octopus Synapse canonical commitlint config. Mirrors the profile-services
 * convention: conventional commits, header ≤ 100 chars, no capitalized subjects,
 * Merge PR commits ignored.
 *
 * Custom rule `no-agent-trailer`: blocks `Co-Authored-By:` trailers naming
 * an AI agent (Claude, ChatGPT/GPT-N, Copilot, Gemini, Cursor, Sourcegraph
 * Cody, Aider). The human author owns the commit — agent attribution
 * belongs in the PR body or release notes, not git history. Renaming the
 * agent in trailers doesn't disguise the source of the change.
 */
const AGENT_TRAILER_RE =
  /^co-authored-by:\s*(?:claude|chatgpt|gpt-?[0-9]+|copilot|gemini|cursor|sourcegraph|cody|aider)\b/im;

const configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-agent-trailer': (parsed: { raw?: string; body?: string | null }) => {
          const haystack = `${parsed.raw ?? ''}\n${parsed.body ?? ''}`;
          if (AGENT_TRAILER_RE.test(haystack)) {
            return [
              false,
              'Co-Authored-By trailer naming an AI agent is not allowed. ' +
                'Attribution belongs in the PR body or release notes.',
            ];
          }
          return [true];
        },
      },
    },
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0, 'always', Infinity],
    'no-agent-trailer': [2, 'always'],
  },
  ignores: [(commit: string): boolean => commit.includes('Merge pull request')],
};

export default configuration;
