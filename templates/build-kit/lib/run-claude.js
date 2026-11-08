// Runs the Claude CLI with the prompt delivered on stdin (never argv, so `ps` cannot read it).
// `claude -p` reads its prompt from stdin when no prompt argument is given.

import { spawn } from 'child_process';
import { claudeArgs } from './claude-options.js';

const OUTPUT_LIMIT = 64 * 1024;
const KILL_GRACE_MS = 10_000;

export class TurnTimedOut extends Error {
  constructor(timeoutMs) {
    super(`Turn timed out after ${Math.round(timeoutMs / 1000)}s and was stopped`);
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Resolves with the turn's output (its last 64 KB, also streamed to this process's stdout) only when
 * the whole prompt was written and the child exited with code 0.
 * Rejects on spawn failure, any stdin error (including EPIPE when the child exits early),
 * a prompt that was not fully delivered, a nonzero exit, or the turn outliving `timeoutMs`
 * (the child is then stopped with SIGTERM, and SIGKILL if it does not exit). It settles exactly once.
 */
export function runClaude({ input, cwd, command = 'claude', args = claudeArgs(), env = process.env, timeoutMs = 0 }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let delivered = false;
    let output = '';
    let timer;
    let killTimer;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const proc = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'inherit'] });
    proc.on('error', fail);
    proc.stdin.on('error', fail);
    proc.stdin.on('finish', () => { delivered = true; });
    proc.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      output = (output + chunk).slice(-OUTPUT_LIMIT);
    });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        fail(new TurnTimedOut(timeoutMs));
        proc.kill('SIGTERM');
        killTimer = setTimeout(() => proc.kill('SIGKILL'), KILL_GRACE_MS);
        killTimer.unref();
      }, timeoutMs);
    }
    proc.on('close', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (code !== 0) return fail(new Error(`Claude exited ${code}`));
      if (!delivered) return fail(new Error('Claude exited before the prompt was fully delivered'));
      if (!settled) {
        settled = true;
        resolve(output);
      }
    });
    proc.stdin.end(input);
  });
}
