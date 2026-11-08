/**
 * @fileoverview Code export server access control
 * The server listens on loopback only, refuses other origins, and requires the per-install secret.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { authorize, corsHeaders, loadOrCreateExportSecret, DEFAULT_ALLOWED_ORIGINS } from '../templates/build-kit/lib/export-auth.js';
import { ensureExportSecret } from '../src/local-files.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const secret = 'a'.repeat(64);
const board = DEFAULT_ALLOWED_ORIGINS[0];
const options = { secret, origins: DEFAULT_ALLOWED_ORIGINS };

describe('export authorization', () => {
  test('a request without the secret is refused', () => {
    assert.deepStrictEqual(authorize('GET', {}, options), { ok: false, status: 401, error: 'Missing or invalid export secret' });
    assert.strictEqual(authorize('POST', { authorization: 'Bearer wrong' }, options).status, 401);
  });

  test('a request from another origin is refused even with the secret', () => {
    assert.strictEqual(authorize('POST', { origin: 'https://evil.example', authorization: `Bearer ${secret}` }, options).status, 403);
    assert.strictEqual(authorize('OPTIONS', { origin: 'https://evil.example' }, options).status, 403);
  });

  test('the board origin with the secret is allowed', () => {
    assert.ok(authorize('POST', { origin: board, authorization: `Bearer ${secret}` }, options).ok);
    assert.ok(authorize('GET', { 'x-export-secret': secret }, options).ok);
    assert.ok(authorize('OPTIONS', { origin: board }, options).ok);
  });

  test('CORS headers are only sent to an allowed origin', () => {
    assert.strictEqual(corsHeaders(board, DEFAULT_ALLOWED_ORIGINS)['Access-Control-Allow-Origin'], board);
    assert.deepStrictEqual(corsHeaders('https://evil.example', DEFAULT_ALLOWED_ORIGINS), {});
  });

  test('the secret is generated once and stored owner-only', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bk-export-'));
    try {
      const path = join(dir, '.eventmodelers', 'config.json');
      const first = loadOrCreateExportSecret(path, {});
      assert.match(first, /^[0-9a-f]{64}$/);
      assert.strictEqual(loadOrCreateExportSecret(path, {}), first);
      if (process.platform !== 'win32') assert.strictEqual(statSync(path).mode & 0o777, 0o600);
      assert.strictEqual(JSON.parse(readFileSync(path, 'utf-8')).codeExportSecret, first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the installer keeps an existing secret and creates one when missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bk-export-'));
    try {
      const path = join(dir, 'config.json');
      assert.strictEqual(ensureExportSecret(path, 'kept', undefined, () => {}), 'kept');
      assert.strictEqual(ensureExportSecret(path, undefined, () => 'new', () => {}), 'kept');
      rmSync(path);
      assert.strictEqual(ensureExportSecret(path, undefined, () => 'new', () => {}), 'new');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('code export server', () => {
  let server;
  let base;

  before(async () => {
    server = spawn(process.execPath, [join(root, 'templates', 'build-kit', 'code-export.mjs')], {
      env: { ...process.env, PORT: '0', CODE_EXPORT_SECRET: secret, WORKSPACE_PATH: tmpdir() },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    base = await new Promise((resolve, reject) => {
      let output = '';
      server.on('error', reject);
      server.stdout.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/running at (http:\/\/[^\s]+)/);
        if (match) resolve(match[1]);
      });
    });
  });

  after(() => server.kill());

  test('listens on loopback only', () => {
    assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
  });

  test('refuses a request without the secret', async () => {
    assert.strictEqual((await fetch(`${base}/api/ping`)).status, 401);
  });

  test('refuses another origin', async () => {
    const res = await fetch(`${base}/api/ping`, { headers: { origin: 'https://evil.example', authorization: `Bearer ${secret}` } });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
  });

  test('answers the board with the secret', async () => {
    const res = await fetch(`${base}/api/ping`, { headers: { origin: board, authorization: `Bearer ${secret}` } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), board);
  });
});
