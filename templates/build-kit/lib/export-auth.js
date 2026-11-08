// Access control for the local code export server.
// The server writes files into the project and commits them, so every request must come from the
// board's origin (or from no browser origin at all) and carry the per-install export secret.

import { randomBytes, timingSafeEqual } from 'crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export const DEFAULT_ALLOWED_ORIGINS = ['https://app.eventmodelers.ai'];
export const SECRET_HEADER = 'x-export-secret';

export function createExportSecret() {
  return randomBytes(32).toString('hex');
}

function readJson(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * The export secret: `CODE_EXPORT_SECRET` when set, otherwise `codeExportSecret` from the kit config,
 * generated and stored owner-only when the config does not have one yet.
 */
export function loadOrCreateExportSecret(configPath, env = process.env) {
  if (env.CODE_EXPORT_SECRET) return env.CODE_EXPORT_SECRET;
  const config = readJson(configPath);
  if (config.codeExportSecret) return config.codeExportSecret;
  config.codeExportSecret = createExportSecret();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
  if (process.platform !== 'win32') chmodSync(configPath, 0o600);
  return config.codeExportSecret;
}

/** Origins allowed to call the server: `CODE_EXPORT_ALLOWED_ORIGINS`, then `codeExportAllowedOrigins`, then the board. */
export function allowedOrigins(configPath, env = process.env) {
  if (env.CODE_EXPORT_ALLOWED_ORIGINS) {
    return env.CODE_EXPORT_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  }
  const configured = readJson(configPath).codeExportAllowedOrigins;
  return Array.isArray(configured) && configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function presentedSecret(headers) {
  const authorization = headers.authorization || '';
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim();
  return headers[SECRET_HEADER] || '';
}

function sameSecret(presented, secret) {
  const a = Buffer.from(String(presented));
  const b = Buffer.from(String(secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Decides whether a request may proceed. Preflight requests only need an allowed origin. */
export function authorize(method, headers, { secret, origins }) {
  const origin = headers.origin;
  if (origin && !origins.includes(origin)) return { ok: false, status: 403, error: 'Origin not allowed' };
  if (method === 'OPTIONS') return { ok: true };
  if (!secret || !sameSecret(presentedSecret(headers), secret)) {
    return { ok: false, status: 401, error: 'Missing or invalid export secret' };
  }
  return { ok: true };
}

/** CORS headers for an allowed origin; nothing for any other origin. */
export function corsHeaders(origin, origins) {
  if (!origin || !origins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Export-Secret',
  };
}
