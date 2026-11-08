// Failed build attempts per slice, kept in .build-kit/build-attempts.json so restarts keep counting.

import { existsSync, readFileSync, writeFileSync } from 'fs';

export class BuildAttempts {
  constructor(path) {
    this.path = path;
  }

  read() {
    if (!existsSync(this.path)) return {};
    try {
      return JSON.parse(readFileSync(this.path, 'utf-8'));
    } catch {
      return {};
    }
  }

  write(state) {
    writeFileSync(this.path, JSON.stringify(state, null, 2), 'utf-8');
  }

  /** Failed attempts so far for the slice. */
  count(sliceId) {
    return this.read()[sliceId]?.attempts ?? 0;
  }

  /** Records a failed attempt and returns the new count. */
  recordFailure(sliceId, reason) {
    const state = this.read();
    const attempts = (state[sliceId]?.attempts ?? 0) + 1;
    state[sliceId] = { attempts, lastFailure: reason, lastAttemptAt: new Date().toISOString() };
    this.write(state);
    return attempts;
  }

  /** Forgets the slice, after it was built or blocked (a re-planned slice starts again). */
  clear(sliceId) {
    const state = this.read();
    if (!(sliceId in state)) return;
    delete state[sliceId];
    this.write(state);
  }
}
