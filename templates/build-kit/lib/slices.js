// The local slice tree: .build-kit/.slices/<context>/index.json and <context>/<folder>/slice.json.
// The board's list endpoint returns summaries only (id, title, status), so the full definition —
// elements, fields and specifications — is fetched per slice right before it is built.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function sliceFolder(slice) {
  return (slice.title ?? slice.id).replaceAll(' ', '').toLowerCase();
}

function contextNameOf(slice) {
  return slice.contextName || slice.context || null;
}

const isPlanned = (slice) => (slice.status || '').toLowerCase() === 'planned';

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return fallback;
  }
}

/** Writes index.json per context and a slice.json per slice from the board's slice summaries. */
export async function persistSlices(board, kitDir) {
  const slices = await board.listSlices();
  const slicesDir = join(kitDir, '.slices');
  mkdirSync(slicesDir, { recursive: true });

  const contexts = {};
  for (const slice of slices) {
    const name = contextNameOf(slice);
    const contextSlug = name ? slugify(name) : 'default';
    if (!contexts[contextSlug]) contexts[contextSlug] = { name: name || 'default', slices: [] };
    contexts[contextSlug].slices.push(slice);
  }

  const plannedCtx = Object.keys(contexts).find((c) => contexts[c].slices.some(isPlanned));
  const activeCtx = plannedCtx || Object.keys(contexts)[0] || 'default';
  writeFileSync(join(slicesDir, 'current_context.json'), JSON.stringify({ name: activeCtx }, null, 2), 'utf-8');

  for (const [contextSlug, { slices: ctxSlices }] of Object.entries(contexts)) {
    const contextDir = join(slicesDir, contextSlug);
    mkdirSync(contextDir, { recursive: true });

    const indexSlices = ctxSlices.map((s, i) => ({
      id: s.id,
      slice: s.title,
      index: i,
      contextName: contextNameOf(s) || contextSlug,
      contextSlug,
      folder: sliceFolder(s),
      status: s.status,
      definition: { id: s.id, title: s.title, status: s.status },
    }));
    writeFileSync(join(contextDir, 'index.json'), JSON.stringify({ slices: indexSlices }, null, 2), 'utf-8');

    for (const slice of ctxSlices) {
      const sliceDir = join(contextDir, sliceFolder(slice));
      mkdirSync(sliceDir, { recursive: true });
      const slicePath = join(sliceDir, 'slice.json');
      // Keep a full definition fetched earlier; only the summary fields are refreshed
      const existing = readJson(slicePath, {});
      writeFileSync(slicePath, JSON.stringify({ ...existing, ...slice }, null, 2), 'utf-8');
    }
  }

  console.log(`[agent] Persisted ${slices.length} slice(s)`);
}

/** Path of a slice's slice.json, relative to the project root, for the build request. */
export function slicePath(entry) {
  return `.build-kit/.slices/${entry.contextSlug}/${entry.folder}/slice.json`;
}

/** Fetches the slice's full definition and writes it to slice.json. Throws when the board has none. */
export async function writeSliceDefinition(board, kitDir, entry) {
  const definition = await board.sliceDefinition(entry.contextName === 'default' ? null : entry.contextName, entry.id);
  if (!definition) throw new Error(`The board returned no definition for slice "${entry.slice}" (${entry.id})`);
  const sliceDir = join(kitDir, '.slices', entry.contextSlug, entry.folder);
  mkdirSync(sliceDir, { recursive: true });
  const full = { ...definition, id: entry.id, title: definition.title ?? entry.slice, status: entry.status };
  writeFileSync(join(sliceDir, 'slice.json'), JSON.stringify(full, null, 2), 'utf-8');
  return full;
}

/** Every slice entry in the local index, in context order. */
export function indexEntries(kitDir) {
  const slicesDir = join(kitDir, '.slices');
  if (!existsSync(slicesDir)) return [];
  const entries = [];
  for (const context of readdirSync(slicesDir)) {
    const indexPath = join(slicesDir, context, 'index.json');
    if (!existsSync(indexPath)) continue;
    const { slices } = readJson(indexPath, {});
    for (const slice of slices || []) entries.push({ contextSlug: context, contextName: context, folder: sliceFolder({ id: slice.id, title: slice.slice }), ...slice });
  }
  return entries;
}

/** The first planned slice the filter accepts, or null. */
export function findPlannedSlice(kitDir, accept = () => true) {
  return indexEntries(kitDir).find((entry) => isPlanned(entry) && accept(entry)) ?? null;
}

/** Records a status for a slice in the local index and its slice.json. */
export function setLocalStatus(kitDir, entry, status) {
  const indexPath = join(kitDir, '.slices', entry.contextSlug, 'index.json');
  const index = readJson(indexPath, null);
  if (index?.slices) {
    for (const slice of index.slices) if (slice.id === entry.id) slice.status = status;
    writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }
  const path = join(kitDir, '.slices', entry.contextSlug, entry.folder, 'slice.json');
  const slice = readJson(path, null);
  if (slice) writeFileSync(path, JSON.stringify({ ...slice, status }, null, 2), 'utf-8');
}

/** Names the slice to build in the turn, so the agent never has to search for it. */
export function buildRequest(entry, attempt, maxAttempts) {
  return [
    '## Build request',
    '',
    `Build slice "${entry.slice}" (id ${entry.id}) in context "${entry.contextName}".`,
    `Its definition is in \`${slicePath(entry)}\` — the source of truth for this build.`,
    ...(attempt ? [`This is attempt ${attempt} of ${maxAttempts}.`] : []),
    '',
  ].join('\n');
}
