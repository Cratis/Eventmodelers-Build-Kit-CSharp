/**
 * @fileoverview Local defaults contract tests
 * Local credentials stay out of git and local services bind to localhost.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf-8');

describe('Local defaults', () => {
  test('root template .gitignore ignores .eventmodelers/', () => {
    const lines = read('templates', 'root', '.gitignore').split(/\r?\n/).map(line => line.trim());
    assert.ok(lines.includes('.eventmodelers/'));
  });

  test('installer adds .eventmodelers/ to the project .gitignore and restricts config file mode', () => {
    const cli = read('src', 'cli.js');
    assert.ok(cli.includes("'.eventmodelers/'"));
    assert.ok(cli.includes('0o600'));
  });

  test('every published compose port is bound to 127.0.0.1', () => {
    const lines = read('templates', 'root', 'docker-compose.yml').split(/\r?\n/);
    const ports = lines.filter(line => /^\s+- ["']?(\d|127\.|0\.0\.0\.0)[\d.]*:\d+/.test(line));
    assert.ok(ports.length > 0);
    for (const line of ports) {
      assert.match(line.trim(), /^- ["']?127\.0\.0\.1:\d+:\d+/, line);
    }
  });

  test('prompts stage explicit paths and never credentials', () => {
    for (const file of ['prompt.md', 'backend-prompt.md']) {
      const text = read('templates', 'build-kit', 'lib', file);
      assert.ok(text.includes('explicit path'), file);
      assert.ok(text.includes('Never stage `.eventmodelers/`'), file);
      assert.ok(!/commit all changes/i.test(text), file);
    }
  });
});
