// Reads the kit-local board configuration (.build-kit/.eventmodelers/config.json).

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const REQUIRED_CREDENTIALS = ['organizationId', 'boardId', 'token', 'baseUrl'];

/** Uses `organizationId` everywhere; `orgId` (written by older `connect` skills) is read as a fallback. */
export function normalizeConfig(config = {}) {
  const normalized = { ...config };
  if (!normalized.organizationId && normalized.orgId) normalized.organizationId = normalized.orgId;
  delete normalized.orgId;
  return normalized;
}

/** The credential fields that are missing or empty. */
export function missingCredentials(cfg = {}) {
  return REQUIRED_CREDENTIALS.filter((field) => !cfg[field]);
}

export function hasCredentials(cfg) {
  return missingCredentials(cfg).length === 0;
}

export function loadLocalConfig(kitDir, env = process.env, warn = console.warn) {
  const configPath = join(kitDir, '.eventmodelers', 'config.json');
  if (!existsSync(configPath)) {
    warn(`[ralph] Note: no .eventmodelers/config.json found — platform sync disabled.`);
    warn(`        To enable board sync, follow: https://app.eventmodelers.ai/documentation#build-cratis-csharp`);
    warn(`        Code generation from local slice definitions will still run.`);
    return {};
  }
  const cfg = normalizeConfig(JSON.parse(readFileSync(configPath, 'utf-8')));
  if (env.BASE_URL) cfg.baseUrl = env.BASE_URL;
  const missing = missingCredentials(cfg);
  if (missing.length > 0) {
    warn(`[ralph] Board sync disabled — ${configPath} is missing: ${missing.join(', ')}`);
    warn(`        Add the missing field(s) (or run the installer again) and restart the loop.`);
  }
  return cfg;
}
