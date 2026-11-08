#!/usr/bin/env node
// Ralph loop + realtime agent using Claude Code as the executor.
// Usage: node ralph-claude.js [project_dir]

import { startRalph, loadLocalConfig } from './lib/ralph.js';
import { runClaude } from './lib/run-claude.js';
import { claudeArgs } from './lib/claude-options.js';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const kitDir = dirname(fileURLToPath(import.meta.url));
const projectDir = process.argv[2] ? resolve(process.argv[2]) : resolve(kitDir, '..');

const cfg = loadLocalConfig(kitDir);
const inlineHeader = cfg.boardId
  ? `board=${cfg.boardId} token=${cfg.token} org=${cfg.organizationId} baseUrl=${cfg.baseUrl}\n\n`
  : '';

const args = claudeArgs(cfg);

function runClaudeWithHeader(prompt) {
  return runClaude({ input: inlineHeader + prompt, cwd: projectDir, args });
}

startRalph({
  kitDir,
  projectDir,
  onTask: runClaudeWithHeader,
  onPlannedSlice: runClaudeWithHeader,
}).catch((err) => {
  console.error('[ralph] Fatal:', err);
  process.exit(1);
});
