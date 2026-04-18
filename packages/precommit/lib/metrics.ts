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

function extractBun(log: string): SuiteMetrics {
  const pass = /(\d+)\s+pass/i.exec(log)?.[1];
  const fail = /(\d+)\s+fail/i.exec(log)?.[1];
  const skip = /(\d+)\s+skip/i.exec(log)?.[1];
  return {
    passed: pass ? Number(pass) : 0,
    failed: fail ? Number(fail) : 0,
    skipped: skip ? Number(skip) : 0,
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
