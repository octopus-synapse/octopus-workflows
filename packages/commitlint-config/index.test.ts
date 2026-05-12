import { describe, expect, test } from 'bun:test';
import configuration from './index';

type RuleFn = (parsed: { raw?: string; body?: string | null }) => readonly [boolean, string?];

function getRule(name: string): RuleFn {
  const plugin = configuration.plugins?.[0];
  if (!plugin || typeof plugin === 'string' || !('rules' in plugin) || !plugin.rules) {
    throw new Error('expected inline plugin with rules');
  }
  const rule = (plugin.rules as Record<string, unknown>)[name];
  if (typeof rule !== 'function') throw new Error(`rule ${name} not found`);
  return rule as RuleFn;
}

describe('no-agent-trailer', () => {
  const rule = getRule('no-agent-trailer');

  test('passes when no trailer is present', () => {
    expect(rule({ raw: 'feat(api): add endpoint', body: null })[0]).toBe(true);
  });

  test('passes when a human Co-Authored-By trailer is present', () => {
    const raw =
      'feat(api): add endpoint\n\nbody\n\nCo-Authored-By: Jane Doe <jane@example.com>';
    expect(rule({ raw, body: 'body' })[0]).toBe(true);
  });

  test('fails on Claude trailer', () => {
    const raw =
      'feat(api): add endpoint\n\nbody\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
    const [ok] = rule({ raw, body: 'body' });
    expect(ok).toBe(false);
  });

  test('fails on ChatGPT trailer', () => {
    const raw =
      'feat(api): add endpoint\n\nbody\n\nCo-Authored-By: ChatGPT <noreply@openai.com>';
    expect(rule({ raw, body: 'body' })[0]).toBe(false);
  });

  test('fails on GPT-4 trailer', () => {
    const raw = 'fix: x\n\nbody\n\nCo-Authored-By: GPT-4 <ai@example.com>';
    expect(rule({ raw, body: 'body' })[0]).toBe(false);
  });

  test('fails on Copilot trailer', () => {
    const raw = 'fix: x\n\nbody\n\nCo-Authored-By: Copilot <noreply@github.com>';
    expect(rule({ raw, body: 'body' })[0]).toBe(false);
  });

  test('fails on Gemini trailer', () => {
    const raw = 'fix: x\n\nCo-Authored-By: Gemini <ai@google.com>';
    expect(rule({ raw, body: '' })[0]).toBe(false);
  });

  test('fails on Cursor trailer', () => {
    const raw = 'fix: x\n\nCo-Authored-By: Cursor <noreply@cursor.so>';
    expect(rule({ raw, body: '' })[0]).toBe(false);
  });

  test('fails on Cody trailer', () => {
    const raw = 'fix: x\n\nCo-Authored-By: Cody <noreply@sourcegraph.com>';
    expect(rule({ raw, body: '' })[0]).toBe(false);
  });

  test('is case-insensitive on the trailer key', () => {
    const raw = 'fix: x\n\nco-authored-by: claude <a@b>';
    expect(rule({ raw, body: '' })[0]).toBe(false);
  });
});
