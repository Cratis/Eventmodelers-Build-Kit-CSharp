// Helpers that keep local credentials out of git and readable only by their owner.

import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { dirname } from 'path';

const OWNER_ONLY = 0o600;

function isIgnoreLine(line) {
  const trimmed = line.trim();
  return trimmed !== '' && !trimmed.startsWith('#');
}

// The same pattern written with or without a leading or trailing slash.
function patternKey(line) {
  return line.trim().replace(/^\//, '').replace(/\/$/, '');
}

// Present only when the last equivalent line is not followed by ANY negation: a later `!` rule
// (wildcard or not) may re-include it, so the exclusion is then re-appended as the final line.
function isEffectivelyIgnored(existingLines, line) {
  const key = patternKey(line);
  let last = -1;
  existingLines.forEach((candidate, index) => {
    if (!candidate.startsWith('!') && patternKey(candidate) === key) last = index;
  });
  if (last === -1) return false;
  return !existingLines.slice(last + 1).some((later) => later.startsWith('!'));
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

  const missing = lines.filter((line) => !isEffectivelyIgnored(existing, line));
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

function git(cwd, args) {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies with git that the credential directory is really ignored, re-appending the exclusion as the
 * final line when it is not. Returns 'ignored', 'not-a-repository' or 'exposed' (a warning is printed).
 */
export function ensureCredentialIgnored(gitignorePath, warn = console.warn) {
  const cwd = dirname(gitignorePath);
  if (!git(cwd, ['rev-parse', '--is-inside-work-tree'])) return 'not-a-repository';
  const probe = ['check-ignore', '-q', '.eventmodelers/config.json'];
  if (git(cwd, probe)) return 'ignored';
  const content = readFileSync(gitignorePath, 'utf-8');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const separator = content === '' || content.endsWith('\n') ? '' : eol;
  writeFileSync(gitignorePath, `${content}${separator}.eventmodelers/${eol}`);
  if (git(cwd, probe)) return 'ignored';
  warn('  ⚠️  .eventmodelers/config.json is NOT ignored by git — fix your ignore rules before committing');
  return 'exposed';
}
