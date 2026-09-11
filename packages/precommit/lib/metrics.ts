/**
 * Test-output metric extraction. Supports Bun's test output format
 * (N pass, M fail, K skip) — identical to the regex the backend uses in
 * parse-test-output.sh. Extensible: add more extractors per runner below.
 */

export interface SuiteMetrics {
  passed: number;
  failed: number;
  skipped: number;
}

export type Runner = 'bun' | 'vitest' | 'playwright' | 'jest' | 'none';

export function extractMetrics(log: string, runner: Runner = 'bun'): SuiteMetrics {
  switch (runner) {
    case 'bun':
      return extractBun(log);
    case 'vitest':
      return extractVitest(log);
    case 'jest':
      return extractJest(log);
    case 'playwright':
      return extractPlaywright(log);
    case 'none':
    default:
      return { passed: 0, failed: 0, skipped: 0 };
  }
}

/**
 * Sum every Bun summary line ending in `word` — ` 65 pass`, or
 * `@fuella/shared test:  65 pass` under a workspace filter.
 *
 * Anchored to the end of the line on purpose. `bun test` prints one line per
 * test when stdout is not a TTY, so an unanchored /(\d+)\s+fail/ matches the
 * *name* of a test — "retries 2 failed webhooks" — long before it reaches the
 * summary, and reports failures on a green suite. Per-test lines end in a
 * duration (`[0.07ms]`); summary lines end in the word itself.
 *
 * Summing beats taking the first match because `bun run --filter '*' test`
 * prints one summary per workspace: `.exec` only ever saw the first one, so a
 * two-workspace monorepo under-reported its own test count.
 *
 * The anchor is Bun-specific and stays here: vitest and jest put their counts
 * mid-line ("42 passed | 1 failed"), so the same trick would break them.
 */
function sumBunSummaries(log: string, word: string): number {
  const re = new RegExp(`(\\d+)\\s+${word}\\s*$`, 'gim');
  let total = 0;
  for (const match of log.matchAll(re)) {
    total += Number(match[1]);
  }
  return total;
}

function extractBun(log: string): SuiteMetrics {
  return {
    passed: sumBunSummaries(log, 'pass'),
    failed: sumBunSummaries(log, 'fail'),
    skipped: sumBunSummaries(log, 'skip'),
  };
}

function extractVitest(log: string): SuiteMetrics {
  // "Test Files  7 passed (7)" / "Tests   42 passed | 1 failed | 3 skipped"
  const passed = /(\d+)\s+passed/i.exec(log)?.[1];
  const failed = /(\d+)\s+failed/i.exec(log)?.[1];
  const skipped = /(\d+)\s+skipped/i.exec(log)?.[1];
  return {
    passed: passed ? Number(passed) : 0,
    failed: failed ? Number(failed) : 0,
    skipped: skipped ? Number(skipped) : 0,
  };
}

function extractJest(log: string): SuiteMetrics {
  // "Tests:       3 passed, 1 failed, 2 skipped, 6 total"
  const passed = /(\d+)\s+passed/i.exec(log)?.[1];
  const failed = /(\d+)\s+failed/i.exec(log)?.[1];
  const skipped = /(\d+)\s+skipped/i.exec(log)?.[1];
  return {
    passed: passed ? Number(passed) : 0,
    failed: failed ? Number(failed) : 0,
    skipped: skipped ? Number(skipped) : 0,
  };
}

function extractPlaywright(log: string): SuiteMetrics {
  // "15 passed (12s)" / "1 failed"
  const passed = /(\d+)\s+passed/i.exec(log)?.[1];
  const failed = /(\d+)\s+failed/i.exec(log)?.[1];
  const skipped = /(\d+)\s+skipped/i.exec(log)?.[1];
  return {
    passed: passed ? Number(passed) : 0,
    failed: failed ? Number(failed) : 0,
    skipped: skipped ? Number(skipped) : 0,
  };
}
