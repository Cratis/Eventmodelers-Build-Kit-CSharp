/**
 * @fileoverview Claude permission contract
 * An unattended turn runs with an explicit allow list, never with permission checks disabled.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { allowedTools, claudeArgs, DEFAULT_ALLOWED_TOOLS } from '../templates/build-kit/lib/claude-options.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = (...parts) => join(root, 'templates', 'build-kit', ...parts);

describe('Claude permissions', () => {
  test('no runner passes --dangerously-skip-permissions', () => {
    for (const file of ['ralph-claude.js', join('lib', 'run-claude.js'), join('lib', 'claude-options.js')]) {
      const text = readFileSync(kit(file), 'utf-8');
      assert.ok(!text.includes("'--dangerously-skip-permissions'"), file);
    }
    assert.ok(!existsSync(kit('lib', 'agent.sh')));
    assert.ok(!existsSync(kit('ralph.sh')));
  });

  test('the arguments accept edits in the project and pass an explicit allow list', () => {
    const args = claudeArgs({}, {});
    assert.ok(!args.some((arg) => /dangerously|bypassPermissions/.test(arg)));
    assert.deepStrictEqual(args.slice(0, 4), ['-p', '--permission-mode', 'acceptEdits', '--allowedTools']);
    assert.deepStrictEqual(args.slice(4), DEFAULT_ALLOWED_TOOLS);
  });

  test('the defaults cover a slice build and nothing that rewrites history', () => {
    for (const tool of ['Bash(dotnet build:*)', 'Bash(dotnet test:*)', 'Bash(git commit:*)', 'Bash(yarn build:*)']) {
      assert.ok(DEFAULT_ALLOWED_TOOLS.includes(tool), tool);
    }
    assert.ok(!DEFAULT_ALLOWED_TOOLS.some((tool) => /git (push|reset|rebase)|Bash\(\*|^Bash$/.test(tool)));
  });

  test('the allow list is extended from the config and the environment', () => {
    const tools = allowedTools({ allowedTools: ['Bash(npm run build:*)'] }, { RALPH_ALLOWED_TOOLS: 'Bash(make:*), Bash(npm run build:*)' });
    assert.ok(tools.includes('Bash(npm run build:*)'));
    assert.ok(tools.includes('Bash(make:*)'));
    assert.strictEqual(tools.filter((tool) => tool === 'Bash(npm run build:*)').length, 1);
  });

  test('entries that bypass permission checks are refused', () => {
    assert.throws(() => allowedTools({ allowedTools: ['--dangerously-skip-permissions'] }, {}), /bypass/);
    assert.throws(() => allowedTools({}, { RALPH_ALLOWED_TOOLS: 'bypassPermissions' }), /bypass/);
  });

  test('a refused command is reported as a blocked slice', () => {
    const text = readFileSync(kit('lib', 'backend-prompt.md'), 'utf-8');
    assert.ok(text.includes('<promise>BLOCKED:'));
  });
});
