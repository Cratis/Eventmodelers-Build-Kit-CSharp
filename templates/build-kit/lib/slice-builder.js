// Builds one planned slice: claim it, fetch its definition, run one agent turn, and set the final
// status. The loop — not the agent — decides Done, Blocked, or another attempt.

import { nodeMeta } from './board-api.js';
import { buildRequest, setLocalStatus, writeSliceDefinition } from './slices.js';

const MINUTE = 60_000;

const positive = (...values) => values.map(Number).find((value) => Number.isFinite(value) && value > 0);

/** Limits from the kit config, then RALPH_* environment variables, then defaults. */
export function loopSettings(cfg = {}, env = process.env) {
  return {
    maxAttempts: positive(cfg.maxBuildAttempts, env.RALPH_MAX_ATTEMPTS) ?? 3,
    turnTimeoutMs: (positive(cfg.turnTimeoutMinutes, env.RALPH_TURN_TIMEOUT_MINUTES) ?? 60) * MINUTE,
    retryDelayMs: (positive(cfg.retryDelaySeconds, env.RALPH_RETRY_DELAY_SECONDS) ?? 60) * 1000,
    claimSettleMs: 3_000,
  };
}

/** Reads the agent's verdict from its output: `<promise>DONE</promise>` or `<promise>BLOCKED: reason</promise>`. */
export function turnOutcome(output = '') {
  const blocked = output.match(/<promise>\s*BLOCKED:?\s*([\s\S]*?)<\/promise>/i);
  if (blocked) return { blocked: blocked[1].trim() || 'The agent reported the slice as blocked' };
  if (/<promise>\s*DONE\s*<\/promise>/i.test(output)) return { done: true };
  return { failure: 'The turn ended without reporting <promise>DONE</promise>' };
}

/** Sets a board status, logging instead of failing: the local outcome must not depend on the network. */
async function tryBoard(log, label, action) {
  try {
    await action();
  } catch (err) {
    log(`[ralph] Could not ${label}: ${err.message}`);
  }
}

/**
 * Claims the slice on the board: it must still be Planned, and after setting InProgress with this
 * agent's id, the board must still name this agent once concurrent claims have settled.
 * Returns null when claimed, or why the slice was skipped and the status the board now shows.
 */
export async function claimSlice(board, entry, agentId, { sleep, claimSettleMs }) {
  const current = (await board.listSlices()).find((slice) => slice.id === entry.id);
  if (!current || (current.status || '').toLowerCase() !== 'planned') {
    return { reason: `no longer Planned (${current?.status ?? 'removed'})`, status: current?.status ?? 'Removed' };
  }
  await board.setSliceStatus(entry.id, 'InProgress', { buildClaim: agentId });
  await sleep(claimSettleMs);
  const claim = nodeMeta(await board.getNode(entry.id)).buildClaim;
  if (claim && claim !== agentId) return { reason: `claimed by another loop (${claim})`, status: 'InProgress' };
  return null;
}

async function block(context, reason) {
  const { board, kitDir, entry, attempts, log } = context;
  log(`[ralph] Slice "${entry.slice}" is Blocked: ${reason}`);
  setLocalStatus(kitDir, entry, 'Blocked');
  attempts.clear(entry.id);
  if (!board) return { status: 'Blocked', reason };
  await tryBoard(log, 'set the slice to Blocked', () => board.setSliceStatus(entry.id, 'Blocked', { buildClaim: '' }));
  await tryBoard(log, 'comment on the slice', () => board.comment(entry.id, `Build kit: the slice is blocked. ${reason}`));
  return { status: 'Blocked', reason };
}

async function fail(context, reason) {
  const { board, kitDir, entry, attempts, settings, log } = context;
  const count = attempts.recordFailure(entry.id, reason);
  if (count >= settings.maxAttempts) return block(context, `The build failed ${count} time(s). Last failure: ${reason}`);
  log(`[ralph] Slice "${entry.slice}" attempt ${count}/${settings.maxAttempts} failed: ${reason}`);
  setLocalStatus(kitDir, entry, 'Planned');
  // Release the claim so this loop (or another) can try again
  if (board) await tryBoard(log, 'release the slice', () => board.setSliceStatus(entry.id, 'Planned', { buildClaim: '' }));
  return { status: 'Retry', reason };
}

/**
 * Builds one planned slice. `board` is null in local-only mode. `runTurn(input, { timeoutMs })`
 * resolves with the turn's output or rejects (failure, timeout). Returns { status, reason }.
 */
export async function buildPlannedSlice({ entry, kitDir, board, attempts, settings, runTurn, prompt, agentId, sleep, log = console.log }) {
  const context = { board, kitDir, entry, attempts, settings, log };

  if (board) {
    let skipped;
    try {
      skipped = await claimSlice(board, entry, agentId, { sleep, claimSettleMs: settings.claimSettleMs });
    } catch (err) {
      return fail(context, `Could not claim the slice: ${err.message}`);
    }
    if (skipped) {
      log(`[ralph] Skipping slice "${entry.slice}": ${skipped.reason}`);
      setLocalStatus(kitDir, entry, skipped.status);
      return { status: 'Skipped', reason: skipped.reason };
    }
    try {
      await writeSliceDefinition(board, kitDir, entry);
    } catch (err) {
      return fail(context, `Could not load the slice definition: ${err.message}`);
    }
  }
  setLocalStatus(kitDir, entry, 'InProgress');

  const attempt = attempts.count(entry.id) + 1;
  let outcome;
  try {
    const output = await runTurn(`${prompt}\n\n${buildRequest(entry, attempt, settings.maxAttempts)}`, { timeoutMs: settings.turnTimeoutMs });
    outcome = turnOutcome(output);
  } catch (err) {
    outcome = { failure: err.message };
  }

  if (outcome.blocked) return block(context, outcome.blocked);
  if (outcome.failure) return fail(context, outcome.failure);

  log(`[ralph] Slice "${entry.slice}" is Done`);
  setLocalStatus(kitDir, entry, 'Done');
  attempts.clear(entry.id);
  if (board) await tryBoard(log, 'set the slice to Done', () => board.setSliceStatus(entry.id, 'Done', { buildClaim: '' }));
  return { status: 'Done' };
}
