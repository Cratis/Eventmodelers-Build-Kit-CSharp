/**
 * @fileoverview Runner contract
 * Claude Code is the only runner; the Ollama runner could not build slices and was removed.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('runners', () => {
  test('the Ollama runner is not shipped', () => {
    assert.ok(!existsSync(join(root, 'templates', 'build-kit', 'ralph-ollama.js')));
    assert.ok(!existsSync(join(root, 'templates', 'build-kit', 'lib', 'ollama-agent.js')));
    assert.ok(!readFileSync(join(root, 'src', 'cli.js'), 'utf-8').includes('ralph-ollama'));
  });

  test('the documentation says local models are not supported for building', () => {
    const install = readFileSync(join(root, 'Documentation', 'getting-started', 'install.md'), 'utf-8');
    assert.ok(install.includes('local models (Ollama) are not supported'));
  });
});
