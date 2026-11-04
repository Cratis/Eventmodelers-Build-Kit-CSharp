/**
 * @fileoverview Claude runner delivery tests
 * A prompt that was not delivered, or a child that failed, must reject.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

import { runClaude } from '../templates/build-kit/lib/run-claude.js';

const node = (script, input) => runClaude({ command: process.execPath, args: ['-e', script], input, cwd: process.cwd() });
const drain = "let n = 0; process.stdin.on('data', (c) => { n += c.length; }); process.stdin.on('end', () => process.exit(%CODE%));";

describe('runClaude', () => {
  test('resolves when the prompt is fully delivered and the child exits 0', async () => {
    await node(drain.replace('%CODE%', '0'), 'x'.repeat(1_000_000));
  });

  test('rejects when the child exits early without reading a large prompt', async () => {
    await assert.rejects(node('process.exit(0)', 'x'.repeat(20_000_000)));
  });

  test('rejects when the command cannot be spawned', async () => {
    await assert.rejects(runClaude({ command: 'eventmodelers-no-such-command', input: 'x'.repeat(1_000_000), cwd: process.cwd() }));
  });

  test('rejects on a nonzero exit', async () => {
    await assert.rejects(node(drain.replace('%CODE%', '3'), 'hello'), /exited 3/);
  });
});
