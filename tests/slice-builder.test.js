/**
 * @fileoverview Slice build lifecycle
 * The loop claims a slice, bounds its attempts, stops hung turns, and sets the final status itself.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { BuildAttempts } from '../templates/build-kit/lib/build-attempts.js';
import { buildPlannedSlice, loopSettings, turnOutcome } from '../templates/build-kit/lib/slice-builder.js';
import { findPlannedSlice, persistSlices } from '../templates/build-kit/lib/slices.js';
import { runClaude, TurnTimedOut } from '../templates/build-kit/lib/run-claude.js';

// One board shared by every loop in a test: last writer wins, like the real node meta
function fakeBoard() {
  const slices = [{ id: 's-1', title: 'Register Author', status: 'Planned', contextName: 'Library' }];
  const meta = {};
  const statuses = [];
  const comments = [];
  return {
    statuses,
    comments,
    status: () => slices[0].status,
    listSlices: async () => slices.map((slice) => ({ ...slice })),
    sliceDefinition: async () => ({ id: 's-1', title: 'Register Author', events: [{ title: 'AuthorRegistered' }] }),
    getNode: async (id) => ({ id, meta: { ...meta[id] } }),
    setSliceStatus: async (id, status, extra = {}) => {
      statuses.push(status);
      slices[0].status = status;
      meta[id] = { ...meta[id], sliceStatus: status, ...extra };
    },
    comment: async (id, text) => { comments.push(text); },
  };
}

const settings = { maxAttempts: 3, turnTimeoutMs: 1000, retryDelayMs: 0, claimSettleMs: 0 };

describe('building a planned slice', () => {
  let kitDir;
  let board;
  let attempts;
  const build = (runTurn, overrides = {}) => buildPlannedSlice({
    entry: findPlannedSlice(kitDir),
    kitDir,
    board,
    attempts,
    settings,
    runTurn,
    prompt: 'build',
    agentId: 'loop-a',
    sleep: async () => {},
    log: () => {},
    ...overrides,
  });

  beforeEach(async () => {
    kitDir = mkdtempSync(join(tmpdir(), 'bk-build-'));
    board = fakeBoard();
    attempts = new BuildAttempts(join(kitDir, 'build-attempts.json'));
    await persistSlices(board, kitDir);
  });
  afterEach(() => rmSync(kitDir, { recursive: true, force: true }));

  test('a successful turn is set to Done by the loop', async () => {
    const result = await build(async () => 'built it <promise>DONE</promise>');
    assert.strictEqual(result.status, 'Done');
    assert.deepStrictEqual(board.statuses, ['InProgress', 'Done']);
  });

  test('the turn names the slice and its attempt', async () => {
    let input;
    await build(async (prompt) => { input = prompt; return '<promise>DONE</promise>'; });
    assert.ok(input.includes('Build slice "Register Author" (id s-1)'));
    assert.ok(input.includes('attempt 1 of 3'));
  });

  test('a slice failing N times is set to Blocked with a comment', async () => {
    const results = [];
    for (let i = 0; i < settings.maxAttempts; i++) {
      await persistSlices(board, kitDir);
      results.push((await build(async () => { throw new Error(`Claude exited 1 (run ${i + 1})`); })).status);
    }
    assert.deepStrictEqual(results, ['Retry', 'Retry', 'Blocked']);
    assert.strictEqual(board.status(), 'Blocked');
    assert.strictEqual(board.comments.length, 1);
    assert.ok(board.comments[0].includes('failed 3 time(s)'));
    assert.ok(board.comments[0].includes('Claude exited 1 (run 3)'));
  });

  test('a turn that ends without DONE counts as a failed attempt', async () => {
    const result = await build(async () => 'I looked around');
    assert.strictEqual(result.status, 'Retry');
    assert.strictEqual(board.status(), 'Planned');
    assert.strictEqual(attempts.count('s-1'), 1);
  });

  test('attempts are kept across restarts', async () => {
    await build(async () => 'nothing');
    assert.strictEqual(new BuildAttempts(join(kitDir, 'build-attempts.json')).count('s-1'), 1);
  });

  test('a refused command blocks the slice with the reason', async () => {
    const result = await build(async () => '<promise>BLOCKED: npm publish was refused</promise>');
    assert.strictEqual(result.status, 'Blocked');
    assert.ok(board.comments[0].includes('npm publish was refused'));
  });

  test('a slice that is no longer Planned is skipped', async () => {
    await board.setSliceStatus('s-1', 'InProgress', { buildClaim: 'loop-b' });
    let ran = false;
    const result = await build(async () => { ran = true; return '<promise>DONE</promise>'; });
    assert.strictEqual(result.status, 'Skipped');
    assert.ok(!ran);
  });

  test('two loops on one board never build the same slice at once', async () => {
    let builds = 0;
    const turn = async () => { builds++; return '<promise>DONE</promise>'; };
    // Both read Planned, both claim, and the board keeps the last claim
    const entry = findPlannedSlice(kitDir);
    let release;
    const settled = new Promise((resolve) => { release = resolve; });
    let waiting = 2;
    const sleep = async () => { if (--waiting === 0) release(); await settled; };
    const results = await Promise.all([
      build(turn, { entry, agentId: 'loop-a', sleep }),
      build(turn, { entry, agentId: 'loop-b', sleep }),
    ]);
    assert.strictEqual(builds, 1);
    assert.deepStrictEqual(results.map((result) => result.status).sort(), ['Done', 'Skipped']);
  });
});

describe('turn limits', () => {
  test('a hung turn is stopped after the timeout', async () => {
    const started = Date.now();
    await assert.rejects(
      runClaude({ command: process.execPath, args: ['-e', 'process.stdin.resume(); setInterval(() => {}, 1000);'], input: 'x', cwd: process.cwd(), timeoutMs: 300 }),
      (err) => err instanceof TurnTimedOut,
    );
    assert.ok(Date.now() - started < 5000);
  });

  test('a turn resolves with its output', async () => {
    const output = await runClaude({ command: process.execPath, args: ['-e', "process.stdin.resume(); process.stdin.on('end', () => console.log('<promise>DONE</promise>'));"], input: 'x', cwd: process.cwd() });
    assert.deepStrictEqual(turnOutcome(output), { done: true });
  });

  test('limits come from config, then environment, then defaults', () => {
    assert.deepStrictEqual(loopSettings({}, {}), { maxAttempts: 3, turnTimeoutMs: 3_600_000, retryDelayMs: 60_000, claimSettleMs: 3_000 });
    assert.strictEqual(loopSettings({ maxBuildAttempts: 5 }, { RALPH_MAX_ATTEMPTS: '2' }).maxAttempts, 5);
    assert.strictEqual(loopSettings({}, { RALPH_TURN_TIMEOUT_MINUTES: '10' }).turnTimeoutMs, 600_000);
  });
});
