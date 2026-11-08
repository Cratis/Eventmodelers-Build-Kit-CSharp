#!/usr/bin/env node
// Ralph loop + realtime agent using Claude Code as the executor.
// Usage: node ralph-claude.js [project_dir]

import { startRalph, loadLocalConfig } from './lib/ralph.js';
import { runClaude } from './lib/run-claude.js';
import { claudeArgs, claudeEnv } from './lib/claude-options.js';
import { turnInput } from './lib/turn-input.js';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const kitDir = dirname(fileURLToPath(import.meta.url));
const projectDir = process.argv[2] ? resolve(process.argv[2]) : resolve(kitDir, '..');

const cfg = loadLocalConfig(kitDir);
const args = claudeArgs(cfg);
const env = claudeEnv(cfg);

function runTurn(prompt) {
  return runClaude({ input: turnInput(cfg, prompt), cwd: projectDir, args, env });
}

startRalph({
  kitDir,
  projectDir,
  onTask: runTurn,
  onPlannedSlice: runTurn,
}).catch((err) => {
  console.error('[ralph] Fatal:', err);
  process.exit(1);
});
