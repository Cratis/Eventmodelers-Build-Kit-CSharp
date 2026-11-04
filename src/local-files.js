// Helpers that keep local credentials out of git and readable only by their owner.

import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs';

const OWNER_ONLY = 0o600;

function isIgnoreLine(line) {
  const trimmed = line.trim();
  return trimmed !== '' && !trimmed.startsWith('#');
}

/**
 * Appends the lines that are missing from a .gitignore, keeping everything already in it.
 * A line counts as present only when no later negation (`!pattern`) could re-include it.
 * Line endings and a missing trailing newline are respected. Returns the lines that were added.
 */
export function mergeGitignore(gitignorePath, lines) {
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${lines.join('\n')}\n`);
    return [...lines];
  }

  const content = readFileSync(gitignorePath, 'utf-8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const existing = content.split(/\r?\n/).map((line) => line.trim());

  const missing = lines.filter((line) => {
    const bare = line.trim();
    const last = existing.lastIndexOf(bare);
    if (last === -1) return true;
    const stem = bare.replace(/\/$/, '');
    return existing.slice(last + 1).some((later) => later.startsWith('!') && later.slice(1).replace(/\/$/, '').startsWith(stem));
  });
  if (missing.length === 0) return [];

  const separator = content === '' || content.endsWith('\n') ? '' : eol;
  writeFileSync(gitignorePath, `${content}${separator}${missing.join(eol)}${eol}`);
  return missing;
}

/** Merges the pattern lines of a template .gitignore into the project's, preserving the project's own rules. */
export function mergeGitignoreFromTemplate(templatePath, targetPath) {
  const patterns = readFileSync(templatePath, 'utf-8').split(/\r?\n/).filter(isIgnoreLine);
  return mergeGitignore(targetPath, patterns);
}

/** Restricts each existing credential file to its owner. Failures are reported through warn, never swallowed. */
export function restrictCredentialFiles(paths, warn = console.warn, chmod = chmodSync) {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      chmod(path, OWNER_ONLY);
    } catch (err) {
      warn(`  ⚠️  Could not restrict permissions on ${path}: ${err?.message} — keep it private`);
    }
  }
}

/** Writes a credential file readable only by its owner. */
export function writeCredentialFile(path, value, warn = console.warn) {
  writeFileSync(path, JSON.stringify(value, null, 2), { mode: OWNER_ONLY });
  restrictCredentialFiles([path], warn);
}

/** Windows has no POSIX modes and ACLs are not managed here, so say so. */
export function windowsCredentialNotice(platform = process.platform, log = console.log) {
  if (platform !== 'win32') return false;
  log('  ℹ️  .eventmodelers/config.json holds a credential: keep it out of shared folders (file permissions are not managed on Windows).');
  return true;
}
