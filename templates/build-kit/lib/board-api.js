// HTTP access to the Eventmodelers board for the loop.

import { randomUUID } from 'crypto';

export class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}: ${body}`);
    this.status = status;
  }
}

export async function fetchJSON(url, options, fetchImpl = fetch) {
  const res = await fetchImpl(url, options);
  if (!res.ok) throw new HttpError(res.status, await res.text());
  return res.json();
}

export async function retryOn401(label, fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        if (attempt < maxRetries) {
          console.warn(`[agent] ${label} — 401, retrying (${attempt}/${maxRetries})...`);
          continue;
        }
        console.error(`[agent] ${label} — 401 after ${maxRetries} retries, shutting down`);
        process.exit(1);
      }
      throw err;
    }
  }
}

/** The slice with the given id from a `slicedata` response, which may hold one slice or a list. */
export function pickSlice(data, sliceId) {
  if (!data) return null;
  if (Array.isArray(data.slices)) {
    return data.slices.find((slice) => slice.id === sliceId) ?? (data.slices.length === 1 ? data.slices[0] : null);
  }
  return data.id || data.title ? data : null;
}

/** The meta of a node record, wherever the board puts it. */
export function nodeMeta(node) {
  return node?.meta ?? node?.data?.meta ?? node?.node?.meta ?? {};
}

export function boardClient(cfg, fetchImpl = fetch) {
  const base = `${cfg.baseUrl}/api/org/${cfg.organizationId}/boards/${cfg.boardId}`;
  const headers = { 'x-token': cfg.token, 'x-board-id': cfg.boardId, 'x-user-id': 'build-kit-loop' };
  const get = (path) => fetchJSON(`${base}${path}`, { headers }, fetchImpl);
  const post = (path, body) => fetchJSON(`${base}${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, fetchImpl);

  return {
    /** Summaries of every slice: id, title, status (and context when the board sends it). */
    async listSlices() {
      return (await get('/slicedata/slices')).slices ?? [];
    },

    /** The full slice definition: elements, fields and specifications. */
    async sliceDefinition(contextName, sliceId) {
      const query = new URLSearchParams({ ...(contextName ? { contextName } : {}), sliceId });
      return pickSlice(await get(`/slicedata?${query}`), sliceId);
    },

    async getNode(nodeId) {
      return get(`/nodes/${encodeURIComponent(nodeId)}`);
    },

    /** Sets the slice status, plus any extra meta, on the slice's border node. */
    async setSliceStatus(sliceId, status, meta = {}) {
      return post('/nodes/events', [{
        id: randomUUID(),
        eventType: 'node:changed',
        nodeId: sliceId,
        boardId: cfg.boardId,
        timestamp: Date.now(),
        changedAttributes: ['sliceStatus', ...Object.keys(meta)],
        meta: { sliceStatus: status, ...meta },
      }]);
    },

    async comment(nodeId, text) {
      return post(`/nodes/${encodeURIComponent(nodeId)}/comments`, { text, type: 'COMMENT', author: 'build-kit' });
    },
  };
}
