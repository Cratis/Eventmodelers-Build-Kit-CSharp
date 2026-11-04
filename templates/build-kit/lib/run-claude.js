// Runs the Claude CLI with the prompt delivered on stdin (never argv, so `ps` cannot read it).
// `claude -p` reads its prompt from stdin when no prompt argument is given.

import { spawn } from 'child_process';

const DEFAULT_ARGS = ['--dangerously-skip-permissions', '-p'];

/**
 * Resolves only when the whole prompt was written and the child exited with code 0.
 * Rejects on spawn failure, any stdin error (including EPIPE when the child exits early),
 * a prompt that was not fully delivered, or a nonzero exit. It settles exactly once.
 */
export function runClaude({ input, cwd, command = 'claude', args = DEFAULT_ARGS }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let delivered = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const proc = spawn(command, args, { cwd, stdio: ['pipe', 'inherit', 'inherit'] });
    proc.on('error', fail);
    proc.stdin.on('error', fail);
    proc.stdin.on('finish', () => { delivered = true; });
    proc.on('close', (code) => {
      if (code !== 0) return fail(new Error(`Claude exited ${code}`));
      if (!delivered) return fail(new Error('Claude exited before the prompt was fully delivered'));
      if (!settled) {
        settled = true;
        resolve();
      }
    });
    proc.stdin.end(input);
  });
}
