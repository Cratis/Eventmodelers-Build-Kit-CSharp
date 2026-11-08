/**
 * @fileoverview Board token handling
 * The token reaches the skills and the MCP server through the environment, never through a prompt.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { turnHeader, turnInput } from '../templates/build-kit/lib/turn-input.js';
import { claudeArgs, claudeEnv, mcpConfig, TOKEN_VARIABLE } from '../templates/build-kit/lib/claude-options.js';
import { runClaude } from '../templates/build-kit/lib/run-claude.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const token = '7f3c2a10-secret-token';
const cfg = { token, boardId: 'board-1', organizationId: 'org-1', baseUrl: 'https://api.example.test' };

describe('board token', () => {
  test('no prompt contains the token', () => {
    for (const prompt of ['prompt.md', 'backend-prompt.md']) {
      const input = turnInput(cfg, readFileSync(join(root, 'templates', 'build-kit', 'lib', prompt), 'utf-8'));
      assert.ok(!input.includes(token), prompt);
    }
  });

  test('the header names board, organization and base URL', () => {
    assert.strictEqual(turnHeader(cfg), 'board=board-1 org=org-1 baseUrl=https://api.example.test\n\n');
    assert.strictEqual(turnHeader({}), '');
  });

  test('the token is not in the process arguments', () => {
    assert.ok(!claudeArgs(cfg, {}).some((arg) => arg.includes(token)));
  });

  test('the MCP server authenticates with the token variable', () => {
    const config = JSON.parse(mcpConfig(cfg));
    assert.strictEqual(config.mcpServers.eventmodelers.url, 'https://api.example.test/mcp');
    assert.strictEqual(config.mcpServers.eventmodelers.headers.Authorization, `Bearer \${${TOKEN_VARIABLE}}`);
    assert.ok(claudeArgs(cfg, {}).includes('--mcp-config'));
  });

  test('the turn environment carries the token for the skills', async () => {
    assert.strictEqual(claudeEnv(cfg, { PATH: 'x' })[TOKEN_VARIABLE], token);
    const script = `process.stdin.resume(); process.stdin.on('end', () => process.exit(process.env.${TOKEN_VARIABLE} === '${token}' ? 0 : 4));`;
    await runClaude({ command: process.execPath, args: ['-e', script], input: 'x', cwd: root, env: claudeEnv(cfg) });
  });

  test('the skills reference the token variable, never a pasted value', () => {
    for (const skill of ['connect', 'load-slice', 'update-slice-status']) {
      const text = readFileSync(join(root, 'templates', '.claude', 'skills', skill, 'SKILL.md'), 'utf-8');
      assert.ok(text.includes('x-token: $EVENTMODELERS_TOKEN'), skill);
      assert.ok(!text.includes('x-token: <TOKEN>'), skill);
    }
  });
});
