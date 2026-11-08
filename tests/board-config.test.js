/**
 * @fileoverview Board configuration contract
 * A fresh install writes everything the loop needs, and the loop recognizes what the connect skill writes.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { completeConfig, needsCompletion, DEFAULT_BASE_URL } from '../src/board-config.js';
import { hasCredentials, loadLocalConfig, missingCredentials, normalizeConfig } from '../templates/build-kit/lib/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const credentials = { organizationId: 'org', boardId: 'board', token: 'token' };

describe('installer config', () => {
  test('a fresh install writes the hosted base URL', () => {
    const config = completeConfig(credentials);
    assert.strictEqual(config.baseUrl, DEFAULT_BASE_URL);
    assert.ok(hasCredentials(config));
  });

  test('the base URL can be overridden', () => {
    assert.strictEqual(completeConfig(credentials, 'http://localhost:3000/').baseUrl, 'http://localhost:3000');
    assert.strictEqual(completeConfig({ ...credentials, baseUrl: 'http://board.local' }).baseUrl, 'http://board.local');
  });

  test('orgId is written as organizationId', () => {
    const config = completeConfig({ orgId: 'org', boardId: 'board', token: 'token' });
    assert.strictEqual(config.organizationId, 'org');
    assert.ok(!('orgId' in config));
  });

  test('an older config without a base URL needs completion; a complete one does not', () => {
    assert.ok(needsCompletion(credentials));
    assert.ok(!needsCompletion(completeConfig(credentials)));
  });

  test('the MCP settings never contain the token itself', () => {
    const cli = readFileSync(join(root, 'src', 'cli.js'), 'utf-8');
    assert.ok(cli.includes("Authorization: 'Bearer ${EVENTMODELERS_TOKEN}'"));
  });
});

describe('loop config', () => {
  let kitDir;
  let warnings;
  const write = (value) => {
    mkdirSync(join(kitDir, '.eventmodelers'), { recursive: true });
    writeFileSync(join(kitDir, '.eventmodelers', 'config.json'), JSON.stringify(value));
  };

  beforeEach(() => { kitDir = mkdtempSync(join(tmpdir(), 'bk-config-')); warnings = []; });
  afterEach(() => rmSync(kitDir, { recursive: true, force: true }));

  test('credentials saved by the connect skill are recognized', () => {
    write({ orgId: 'org', boardId: 'board', token: 'token', baseUrl: 'http://x' });
    const cfg = loadLocalConfig(kitDir, {}, (line) => warnings.push(line));
    assert.strictEqual(cfg.organizationId, 'org');
    assert.ok(hasCredentials(cfg));
    assert.deepStrictEqual(warnings, []);
  });

  test('starting without complete credentials names the missing field', () => {
    write({ organizationId: 'org', boardId: 'board', token: 'token' });
    loadLocalConfig(kitDir, {}, (line) => warnings.push(line));
    assert.ok(warnings.some((line) => line.includes('missing: baseUrl')));
  });

  test('BASE_URL still overrides the config', () => {
    write({ ...credentials, baseUrl: 'http://x' });
    assert.strictEqual(loadLocalConfig(kitDir, { BASE_URL: 'http://y' }, () => {}).baseUrl, 'http://y');
  });

  test('missing fields are listed in a stable order', () => {
    assert.deepStrictEqual(missingCredentials({ boardId: 'b' }), ['organizationId', 'token', 'baseUrl']);
    assert.deepStrictEqual(normalizeConfig({ orgId: 'o', organizationId: 'p' }), { organizationId: 'p' });
  });

  test('the connect skill writes organizationId', () => {
    const skill = readFileSync(join(root, 'templates', '.claude', 'skills', 'connect', 'SKILL.md'), 'utf-8');
    assert.ok(skill.includes('"organizationId": "<ORG_ID>"'));
    assert.ok(!skill.includes('"orgId": "<ORG_ID>"'));
  });
});
