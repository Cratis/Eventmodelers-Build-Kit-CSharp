/**
 * @fileoverview Local defaults contract tests
 * Local credentials stay out of git and readable only by their owner; local services bind to localhost.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, statSync, chmodSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  ensureCredentialIgnored,
  mergeGitignore,
  mergeGitignoreFromTemplate,
  restrictCredentialFiles,
  writeCredentialFile,
  windowsCredentialNotice,
} from '../src/local-files.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf-8');
const posix = process.platform !== 'win32';
const mode = (path) => statSync(path).mode & 0o777;

describe('gitignore merge', () => {
  let dir;
  let file;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'bk-ignore-')); file = join(dir, '.gitignore'); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test('creates a missing file', () => {
    assert.deepStrictEqual(mergeGitignore(file, ['.build-kit/', '.eventmodelers/']), ['.build-kit/', '.eventmodelers/']);
    assert.strictEqual(readFileSync(file, 'utf-8'), '.build-kit/\n.eventmodelers/\n');
  });

  test('is idempotent', () => {
    mergeGitignore(file, ['.eventmodelers/']);
    const first = readFileSync(file, 'utf-8');
    assert.deepStrictEqual(mergeGitignore(file, ['.eventmodelers/']), []);
    assert.strictEqual(readFileSync(file, 'utf-8'), first);
  });

  test('handles a missing trailing newline', () => {
    writeFileSync(file, '.env');
    mergeGitignore(file, ['.eventmodelers/']);
    assert.strictEqual(readFileSync(file, 'utf-8'), '.env\n.eventmodelers/\n');
  });

  test('keeps CRLF line endings and detects existing entries', () => {
    writeFileSync(file, '.env\r\n.eventmodelers/\r\nbin/');
    assert.deepStrictEqual(mergeGitignore(file, ['.eventmodelers/', '.build-kit/']), ['.build-kit/']);
    assert.strictEqual(readFileSync(file, 'utf-8'), '.env\r\n.eventmodelers/\r\nbin/\r\n.build-kit/\r\n');
  });

  test('re-adds an entry that a later negation would re-include', () => {
    writeFileSync(file, '.eventmodelers/\n!.eventmodelers/config.json\n');
    assert.deepStrictEqual(mergeGitignore(file, ['.eventmodelers/']), ['.eventmodelers/']);
    assert.ok(readFileSync(file, 'utf-8').endsWith('!.eventmodelers/config.json\n.eventmodelers/\n'));
  });

  test('treats any later negation, even indented or wildcard, as re-including', () => {
    for (const negation of ['!*/', '  !/.eventmodelers/', '!*']) {
      writeFileSync(file, `.eventmodelers/\n${negation}\n`);
      assert.deepStrictEqual(mergeGitignore(file, ['.eventmodelers/']), ['.eventmodelers/'], negation);
    }
  });

  test('recognizes equivalent spellings of the entry', () => {
    writeFileSync(file, '/.eventmodelers\n');
    assert.deepStrictEqual(mergeGitignore(file, ['.eventmodelers/']), []);
  });

  test('preserves an existing project .gitignore when merging the template', () => {
    writeFileSync(file, '# mine\n.env\nsecrets/\n');
    mergeGitignoreFromTemplate(join(root, 'templates', 'root', '.gitignore'), file);
    const lines = readFileSync(file, 'utf-8').split('\n');
    assert.ok(lines.includes('.env') && lines.includes('secrets/') && lines.includes('# mine'));
    assert.ok(lines.includes('.eventmodelers/'));
    assert.strictEqual(lines.filter((line) => line === '.eventmodelers/').length, 1);
  });
});

const hasGit = (() => { try { execFileSync('git', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

describe('credential directory is ignored by git', { skip: !hasGit }, () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bk-git-'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const isIgnored = () => {
    try { execFileSync('git', ['check-ignore', '-q', '.eventmodelers/config.json'], { cwd: dir, stdio: 'ignore' }); return true; } catch { return false; }
  };

  for (const rules of [
    '',
    '.eventmodelers/\n!*/\n',
    '.eventmodelers/\n!/.eventmodelers/\n',
    '.eventmodelers/\n!.eventmodelers/config.json\n',
    '.eventmodelers\n!.eventmodelers/\n',
    '*\n!.eventmodelers/\n',
    '.env\n!.env.example',
  ]) {
    test(`ignored after merge and verify for rules ${JSON.stringify(rules)}`, () => {
      const file = join(dir, '.gitignore');
      if (rules) writeFileSync(file, rules);
      mergeGitignore(file, ['.build-kit/', '.eventmodelers/']);
      const warnings = [];
      assert.strictEqual(ensureCredentialIgnored(file, (m) => warnings.push(m)), 'ignored');
      assert.ok(isIgnored());
      assert.deepStrictEqual(warnings, []);
    });
  }

  test('is a no-op outside a git repository', () => {
    const plain = mkdtempSync(join(tmpdir(), 'bk-nogit-'));
    try {
      writeFileSync(join(plain, '.gitignore'), '');
      assert.strictEqual(ensureCredentialIgnored(join(plain, '.gitignore'), () => {}), 'not-a-repository');
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });
});

describe('credential file permissions', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'bk-cred-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  test('tightens existing world-readable copies at both locations', { skip: !posix }, () => {
    const paths = ['root', 'kit'].map((name) => {
      mkdirSync(join(dir, name));
      const path = join(dir, name, 'config.json');
      writeFileSync(path, '{}');
      chmodSync(path, 0o644);
      return path;
    });
    restrictCredentialFiles([...paths, join(dir, 'absent.json')]);
    for (const path of paths) assert.strictEqual(mode(path), 0o600);
  });

  test('writes new credential files owner-only', { skip: !posix }, () => {
    const path = join(dir, 'config.json');
    writeCredentialFile(path, { token: 'x' });
    assert.strictEqual(mode(path), 0o600);
  });

  test('warns instead of silently ignoring a failed chmod', () => {
    const path = join(dir, 'config.json');
    writeFileSync(path, '{}');
    const warnings = [];
    restrictCredentialFiles([path], (m) => warnings.push(m), () => { throw new Error('denied'); });
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes('denied'));
  });

  test('prints a notice only on Windows', () => {
    const lines = [];
    assert.strictEqual(windowsCredentialNotice('linux', (m) => lines.push(m)), false);
    assert.strictEqual(windowsCredentialNotice('win32', (m) => lines.push(m)), true);
    assert.strictEqual(lines.length, 1);
  });
});

describe('Local defaults', () => {
  test('root template .gitignore ignores .eventmodelers/', () => {
    const lines = read('templates', 'root', '.gitignore').split(/\r?\n/).map(line => line.trim());
    assert.ok(lines.includes('.eventmodelers/'));
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

  test('the connect skill writes owner-only and ignores the whole directory', () => {
    const text = read('templates', '.claude', 'skills', 'connect', 'SKILL.md');
    assert.ok(text.includes('umask 077'));
    assert.ok(text.includes('chmod 600 .eventmodelers/config.json'));
    assert.ok(text.includes('git check-ignore -q .eventmodelers/config.json'));
    assert.ok(!text.includes('grep -qx'));
  });

  test('the Claude runner does not put the board token in process arguments', () => {
    const text = read('templates', 'build-kit', 'ralph-claude.js');
    assert.ok(text.includes('input: inlineHeader + prompt'));
    assert.ok(!text.includes('spawn('));
  });
});
