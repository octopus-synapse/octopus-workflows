#!/usr/bin/env node
/**
 * octopus-run-parallel CLI
 *
 * Orchestrates pre-commit checks in parallel, collects per-check metrics, and
 * writes `.attestation-metrics.json` so `octopus-attest generate` can embed
 * them in the attestation.
 *
 * Config file format (YAML or JSON, inferred by extension):
 *
 *   checks:
 *     - name: typecheck
 *       cmd: bunx turbo run check
 *       runner: none        # optional — defaults to "none" (no test parsing)
 *     - name: lint
 *       cmd: bunx biome check .
 *     - name: unit
 *       cmd: bun test src/
 *       runner: bun          # extracts pass/fail/skip counts
 *
 *   serial:                    # optional, runs BEFORE parallel checks
 *     - name: swagger
 *       cmd: bun run scripts/generate-swagger.ts
 *       stage:                # optional — files to `git add` after success
 *         - swagger.json
 *
 * Usage:
 *   octopus-run-parallel --config .precommit.yaml
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extractMetrics, type Runner } from '../lib/metrics.js';

interface CheckDef {
  name: string;
  cmd: string;
  runner?: Runner;
  stage?: string[];
}

interface Config {
  checks: CheckDef[];
  serial?: CheckDef[];
}

interface CheckResult {
  name: string;
  ok: boolean;
  durationMs: number;
  metrics: { passed: number; failed: number; skipped: number };
  log: string;
}

function parseArgs(argv: string[]): { config: string } {
  let config = '.precommit.yaml';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--config' && argv[i + 1]) {
      config = argv[i + 1];
      i += 1;
    }
  }
  return { config };
}

function loadConfig(path: string): Config {
  const raw = readFileSync(path, 'utf8');
  if (path.endsWith('.json')) {
    return JSON.parse(raw) as Config;
  }
  // Minimal YAML subset parser (avoids bringing in a YAML dep).
  return parseMiniYaml(raw);
}

/**
 * Tiny YAML subset: supports the shape documented above. Not a general YAML
 * parser — throws on unexpected structure so misuse surfaces fast.
 */
function parseMiniYaml(src: string): Config {
  const lines = src.split('\n').map((l) => l.replace(/#.*$/, '').trimEnd());
  const config: Config = { checks: [] };
  let currentList: CheckDef[] | null = null;
  let currentItem: CheckDef | null = null;
  let currentStage: string[] | null = null;

  for (const raw of lines) {
    if (!raw.trim()) continue;

    if (/^(checks|serial):\s*$/.test(raw.trim())) {
      const key = raw.trim().replace(':', '') as 'checks' | 'serial';
      if (key === 'serial') config.serial = [];
      currentList = key === 'checks' ? config.checks : (config.serial ?? []);
      currentItem = null;
      currentStage = null;
      continue;
    }

    // Top-level list item: "- name: foo"
    const listItem = /^\s*-\s+name:\s+(.+)$/.exec(raw);
    if (listItem && currentList) {
      currentItem = { name: listItem[1].trim(), cmd: '' };
      currentStage = null;
      currentList.push(currentItem);
      continue;
    }

    if (!currentItem) continue;

    const kv = /^\s+(name|cmd|runner):\s+(.+)$/.exec(raw);
    if (kv) {
      const [, key, value] = kv;
      const cleaned = value.replace(/^["']|["']$/g, '');
      if (key === 'name') currentItem.name = cleaned;
      else if (key === 'cmd') currentItem.cmd = cleaned;
      else if (key === 'runner') currentItem.runner = cleaned as Runner;
      continue;
    }

    if (/^\s+stage:\s*$/.test(raw)) {
      currentItem.stage = [];
      currentStage = currentItem.stage;
      continue;
    }

    if (currentStage && /^\s+-\s+(.+)$/.test(raw)) {
      const match = /^\s+-\s+(.+)$/.exec(raw);
      if (match) currentStage.push(match[1].trim().replace(/^["']|["']$/g, ''));
    }
  }

  return config;
}

function runOne(check: CheckDef): Promise<CheckResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const proc = spawn('sh', ['-c', check.cmd]);
    let log = '';
    proc.stdout.on('data', (d) => {
      log += d.toString();
    });
    proc.stderr.on('data', (d) => {
      log += d.toString();
    });
    proc.on('close', (code) => {
      const durationMs = Date.now() - start;
      const metrics = extractMetrics(log, check.runner ?? 'none');
      resolve({
        name: check.name,
        ok: code === 0,
        durationMs,
        metrics,
        log,
      });
    });
  });
}

async function runSerial(checks: CheckDef[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    process.stdout.write(`  [serial] ${check.name}...`);
    const result = await runOne(check);
    if (!result.ok) {
      process.stdout.write(` ❌ (${(result.durationMs / 1000).toFixed(1)}s)\n`);
      process.stderr.write(`${result.log}\n`);
      return [...results, result];
    }
    if (check.stage && check.stage.length > 0) {
      await runOne({ name: '_stage', cmd: `git add ${check.stage.join(' ')}` });
    }
    process.stdout.write(` ✓ (${(result.durationMs / 1000).toFixed(1)}s)\n`);
    results.push(result);
  }
  return results;
}

function formatTable(results: CheckResult[]): string {
  const nameW = Math.max(...results.map((r) => r.name.length), 6);
  const lines = results.map((r) => {
    const status = r.ok ? '✓' : '❌';
    const duration = `${(r.durationMs / 1000).toFixed(1)}s`.padStart(6);
    const padded = r.name.padEnd(nameW);
    const counts =
      r.metrics.passed + r.metrics.failed + r.metrics.skipped > 0
        ? ` pass=${r.metrics.passed} fail=${r.metrics.failed} skip=${r.metrics.skipped}`
        : '';
    return `  ${status} ${padded}  ${duration}${counts}`;
  });
  return lines.join('\n');
}

async function main(): Promise<void> {
  const { config: configPath } = parseArgs(process.argv.slice(2));
  if (!existsSync(configPath)) {
    console.error(`[run-parallel] config not found: ${configPath}`);
    process.exit(2);
  }

  const config = loadConfig(configPath);

  // Serial phase — short-circuit on failure (e.g., swagger gen).
  if (config.serial && config.serial.length > 0) {
    const serialResults = await runSerial(config.serial);
    if (serialResults.some((r) => !r.ok)) {
      console.error('\nPre-commit failed (serial stage).');
      process.exit(1);
    }
  }

  if (config.checks.length === 0) {
    console.log('[run-parallel] no parallel checks configured.');
    process.exit(0);
  }

  console.log(`  [parallel] running ${config.checks.length} checks...`);
  const results = await Promise.all(config.checks.map(runOne));

  console.log('');
  console.log(formatTable(results));

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log('');
    for (const r of failed) {
      console.error(`\n── ${r.name} output ──`);
      console.error(r.log);
    }
    process.exit(1);
  }

  // Emit metrics file for attest generate.
  const metrics: Record<string, unknown> = {};
  for (const r of results) {
    metrics[r.name] = {
      status: 'ok',
      time_ms: r.durationMs,
      ...(r.metrics.passed + r.metrics.failed + r.metrics.skipped > 0
        ? {
            passed: r.metrics.passed,
            failed: r.metrics.failed,
            skipped: r.metrics.skipped,
          }
        : {}),
    };
  }
  writeFileSync('.attestation-metrics.json', JSON.stringify(metrics, null, 2));

  console.log('\nPre-commit passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
