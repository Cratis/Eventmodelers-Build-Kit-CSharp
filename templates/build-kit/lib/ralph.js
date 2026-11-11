// Common runtime for the ralph loop + realtime agent.
// Not meant to be run directly — use ralph-claude.js.
//
// startRalph({ kitDir, projectDir, onTask, onPlannedSlice })
//   onTask(prompt, { timeoutMs }) — called when tasks.json has entries
//   onPlannedSlice(prompt, { timeoutMs }) — called for a "Planned" slice (omit to skip); resolves with
//   the turn's output, from which the loop reads the agent's verdict

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { hostname } from 'os';
import { BuildAttempts } from './build-attempts.js';
import { buildPlannedSlice, loopSettings } from './slice-builder.js';
import { hasCredentials, loadLocalConfig } from './config.js';
import { boardClient, fetchJSON, retryOn401 } from './board-api.js';
import { findPlannedSlice, persistSlices } from './slices.js';

// ── Config ────────────────────────────────────────────────────────────────────

async function fetchPlatformConfig(local) {
  const remote = await fetchJSON(`${local.baseUrl}/api/config`, {
    headers: { 'x-token': local.token },
  });
  return { ...local, ...remote };
}

// ── Realtime agent ────────────────────────────────────────────────────────────

async function getRealtimeToken(cfg) {
  const { token } = await fetchJSON(
    `${cfg.baseUrl}/api/org/${cfg.organizationId}/prompts/realtime-token`,
    { headers: { 'x-token': cfg.token } },
  );
  return token;
}

async function writeTask(payload, kitDir) {
  const tasksPath = join(kitDir, 'tasks.json');
  const existing = existsSync(tasksPath) ? JSON.parse(readFileSync(tasksPath, 'utf-8')) : [];
  const filtered = existing.filter(t => t.payload?.sliceId !== payload.sliceId);
  const task = { id: randomUUID(), createdAt: new Date().toISOString(), payload };
  filtered.push(task);
  writeFileSync(tasksPath, JSON.stringify(filtered, null, 2), 'utf-8');
  console.log(`[agent] Task written — slice="${payload.sliceTitle}" status="${payload.sliceStatus}"`);
}

async function pingAgent(cfg, realtimeToken) {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/agent-alive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${realtimeToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cfg.token }),
    });
    if (!res.ok) console.error(`[agent] Ping failed: ${res.status}`);
  } catch (err) {
    console.error('[agent] Ping error:', err);
  }
}

async function startRealtimeAgent(cfg, kitDir) {
  const { createClient } = await import('@supabase/supabase-js');
  const board = boardClient(cfg);
  let realtimeToken = await retryOn401('getRealtimeToken', () => getRealtimeToken(cfg));

  await retryOn401('persistSlices', () => persistSlices(board, kitDir)).catch((err) =>
    console.error('[agent] Initial slice fetch error:', err),
  );

  const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    realtime: { params: { apikey: cfg.supabaseAnonKey } },
  });
  await supabase.realtime.setAuth(realtimeToken);

  const channelName = `board:${cfg.boardId}-slicechanged`;

  supabase
    .channel(channelName, { config: { private: true } })
    .on('broadcast', { event: 'message' }, (msg) => {
      if (msg.payload === 'Exit') {
        console.log('[agent] Received "Exit" — shutting down');
        process.exit(0);
      }
    })
    .on('broadcast', { event: 'slice:changed' }, async (msg) => {
      const payload = msg.payload;
      console.log(`[agent] slice:changed — slice="${payload.sliceTitle}" status="${payload.sliceStatus}"`);
      await retryOn401('persistSlices', () => persistSlices(board, kitDir)).catch((err) =>
        console.error('[agent] Slice persist error:', err),
      );
      // Planned slices are handled by onPlannedSlice directly — no task needed
      if ((payload.sliceStatus || '').toLowerCase() !== 'planned') {
        await writeTask(payload, kitDir).catch((err) => console.error('[agent] writeTask error:', err));
      }
    })
    .subscribe((status) => console.log(`[agent] Channel "${channelName}": ${status}`));

  setInterval(async () => {
    try {
      realtimeToken = await retryOn401('getRealtimeToken (refresh)', () => getRealtimeToken(cfg));
      supabase.realtime.setAuth(realtimeToken);
      console.log('[agent] Token refreshed');
    } catch (err) {
      console.error('[agent] Token refresh failed:', err);
    }
  }, 10 * 60 * 1000);

  const ping = async () => pingAgent(cfg, realtimeToken);
  await ping();
  setInterval(ping, 30_000);
}

// ── Ralph loop ────────────────────────────────────────────────────────────────

function hasPendingTasks(kitDir) {
  const tasksPath = join(kitDir, 'tasks.json');
  if (!existsSync(tasksPath)) return false;
  try {
    const tasks = JSON.parse(readFileSync(tasksPath, 'utf-8'));
    return Array.isArray(tasks) && tasks.length > 0;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dropOldestTask(kitDir) {
  const tasksPath = join(kitDir, 'tasks.json');
  try {
    const tasks = JSON.parse(readFileSync(tasksPath, 'utf-8'));
    tasks.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const [dropped] = tasks.splice(0, 1);
    writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf-8');
    return dropped;
  } catch (err) {
    // An unreadable tasks.json cannot be repaired here; replace it so the loop does not spin on it
    console.error(`[ralph] tasks.json is unreadable (${err.message}) — resetting it`);
    writeFileSync(tasksPath, '[]', 'utf-8');
    return null;
  }
}

// A task turn gets the same limits as a build: a timeout per turn and a bounded number of attempts
async function runTask(kitDir, onTask, prompt, settings) {
  for (let attempt = 1; attempt <= settings.maxAttempts; attempt++) {
    try {
      console.log(`[ralph] onTask: loading slice from board (attempt ${attempt}/${settings.maxAttempts})...`);
      await onTask(prompt, { timeoutMs: settings.turnTimeoutMs });
      return;
    } catch (err) {
      console.error(`[ralph] Task turn failed: ${err.message}`);
      if (attempt < settings.maxAttempts) await sleep(settings.retryDelayMs);
    }
  }
  const dropped = dropOldestTask(kitDir);
  console.error(`[ralph] Dropped task ${dropped?.id} (slice "${dropped?.payload?.sliceTitle}") after ${settings.maxAttempts} failed turns`);
}

async function runPlannedSlice(planned, context, credentialed, backendPromptFile) {
  console.log(`[ralph] onPlannedSlice: building slice "${planned.slice}"...`);
  const result = await buildPlannedSlice({
    entry: planned,
    ...context,
    prompt: readFileSync(backendPromptFile, 'utf-8'),
  });
  if (credentialed) await persistSlices(context.board, context.kitDir).catch(() => {});
  if (result.status === 'Retry') await sleep(context.settings.retryDelayMs);
}

async function ralphLoop(kitDir, cfg, onTask, onPlannedSlice) {
  const promptFile = join(kitDir, 'lib', 'prompt.md');
  const backendPromptFile = join(kitDir, 'lib', 'backend-prompt.md');
  const credentialed = hasCredentials(cfg);
  const board = credentialed ? boardClient(cfg) : null;
  const settings = loopSettings(cfg);
  const attempts = new BuildAttempts(join(kitDir, 'build-attempts.json'));
  const agentId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
  const buildContext = { kitDir, board, attempts, settings, runTurn: onPlannedSlice, agentId, sleep };

  while (true) {
    let didWork = false;

    if (credentialed && hasPendingTasks(kitDir)) {
      await runTask(kitDir, onTask, readFileSync(promptFile, 'utf-8'), settings);
      await persistSlices(board, kitDir).catch(() => {});
      didWork = true;
    }

    // A slice that used up its attempts is skipped even if a Blocked update did not reach the board
    const planned = onPlannedSlice && findPlannedSlice(kitDir, (entry) => attempts.count(entry.id) < settings.maxAttempts);
    if (planned) {
      await runPlannedSlice(planned, buildContext, credentialed, backendPromptFile);
      didWork = true;
    }

    if (!didWork) await sleep(10_000);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export { loadLocalConfig, fetchPlatformConfig, retryOn401, startRealtimeAgent };

export async function startRalph({ kitDir, projectDir, onTask, onPlannedSlice }) {
  const local = loadLocalConfig(kitDir);

  console.log(`Ralph — kit: ${kitDir}`);
  console.log(`         project: ${projectDir}`);

  if (!hasCredentials(local)) {
    console.log(`         mode: local-only (no platform sync)\n`);
    await ralphLoop(kitDir, local, onTask, onPlannedSlice);
    return;
  }

  const cfg = await retryOn401('fetchPlatformConfig', () => fetchPlatformConfig(local));
  console.log(`         org=${cfg.organizationId}, board=${cfg.boardId}, base=${cfg.baseUrl}\n`);

  await Promise.all([
    startRealtimeAgent(cfg, kitDir),
    ralphLoop(kitDir, cfg, onTask, onPlannedSlice),
  ]);
}
