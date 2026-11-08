// Common runtime for the ralph loop + realtime agent.
// Not meant to be run directly — use ralph-claude.js.
//
// startRalph({ kitDir, projectDir, onTask, onPlannedSlice })
//   onTask(prompt) — called when tasks.json has entries
//   onPlannedSlice(prompt) — called when .slices/ has a "Planned" entry (omit to skip)

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { hasCredentials, loadLocalConfig } from './config.js';
import { boardClient, fetchJSON, retryOn401 } from './board-api.js';
import { buildRequest, findPlannedSlice, persistSlices, writeSliceDefinition } from './slices.js';

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

  const ping = async () => {
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
  };
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

async function runWithRetry(label, fn) {
  while (true) {
    try {
      console.log(`[ralph] ${label}`);
      await fn();
      return;
    } catch (err) {
      console.error(`[ralph] Error — retrying in 60s:`, err.message);
      await new Promise((r) => setTimeout(r, 60_000));
    }
  }
}

async function ralphLoop(kitDir, cfg, onTask, onPlannedSlice) {
  const promptFile = join(kitDir, 'lib', 'prompt.md');
  const backendPromptFile = join(kitDir, 'lib', 'backend-prompt.md');
  const credentialed = hasCredentials(cfg);
  const board = credentialed ? boardClient(cfg) : null;

  while (true) {
    let didWork = false;

    if (credentialed && hasPendingTasks(kitDir)) {
      const prompt = readFileSync(promptFile, 'utf-8');
      await runWithRetry('onTask: loading slice from board...', () => onTask(prompt));
      await persistSlices(board, kitDir).catch(() => {});
      didWork = true;
    }

    const planned = onPlannedSlice && findPlannedSlice(kitDir);
    if (planned) {
      await runWithRetry(`onPlannedSlice: building slice "${planned.slice}"...`, async () => {
        // The list endpoint holds summaries only: fetch the full definition before every build
        if (board) await writeSliceDefinition(board, kitDir, planned);
        await onPlannedSlice(`${readFileSync(backendPromptFile, 'utf-8')}\n\n${buildRequest(planned)}`);
      });
      console.log(`[ralph] Slice build complete — waiting for next slice`);
      if (credentialed) await persistSlices(board, kitDir).catch(() => {});
      didWork = true;
    }

    if (!didWork) await new Promise((r) => setTimeout(r, 10_000));
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
