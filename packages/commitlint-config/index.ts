import type { UserConfig } from '@commitlint/types';

/**
 * Octopus Synapse canonical commitlint config. Mirrors the profile-services
 * convention: conventional commits, header ≤ 100 chars, no capitalized subjects,
 * Merge PR commits ignored.
 */
const configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
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
  },
  ignores: [(commit: string): boolean => commit.includes('Merge pull request')],
};

export default configuration;
