/**
 * @fileoverview Slice definition contract
 * The list endpoint holds summaries only; the full definition is written to slice.json before a build,
 * and each build turn names the slice to build.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { boardClient, pickSlice } from '../templates/build-kit/lib/board-api.js';
import { buildRequest, findPlannedSlice, persistSlices, setLocalStatus, writeSliceDefinition } from '../templates/build-kit/lib/slices.js';

const summary = { id: 's-1', title: 'Register Author', status: 'Planned', contextName: 'Library' };
const definition = {
  id: 's-1',
  title: 'Register Author',
  commands: [{ title: 'RegisterAuthor', fields: [{ name: 'name', type: 'String' }] }],
  events: [{ title: 'AuthorRegistered', fields: [{ name: 'name', type: 'String' }] }],
  specifications: [{ title: 'registers an author' }],
};

function fakeBoard() {
  const calls = [];
  return {
    calls,
    listSlices: async () => [summary, { id: 's-2', title: 'Authors', status: 'Done', contextName: 'Library' }],
    sliceDefinition: async (contextName, sliceId) => { calls.push({ contextName, sliceId }); return sliceId === 's-1' ? definition : null; },
  };
}

describe('slice definitions', () => {
  let kitDir;
  beforeEach(() => { kitDir = mkdtempSync(join(tmpdir(), 'bk-slices-')); });
  afterEach(() => rmSync(kitDir, { recursive: true, force: true }));

  const sliceJson = () => JSON.parse(readFileSync(join(kitDir, '.slices', 'library', 'registerauthor', 'slice.json'), 'utf-8'));

  test('the summary alone does not hold the definition', async () => {
    await persistSlices(fakeBoard(), kitDir);
    assert.strictEqual(sliceJson().commands, undefined);
  });

  test('slice.json holds elements, fields and specifications before a build', async () => {
    const board = fakeBoard();
    await persistSlices(board, kitDir);
    const entry = findPlannedSlice(kitDir);
    await writeSliceDefinition(board, kitDir, entry);
    const slice = sliceJson();
    assert.deepStrictEqual(board.calls, [{ contextName: 'Library', sliceId: 's-1' }]);
    assert.strictEqual(slice.commands[0].fields[0].name, 'name');
    assert.strictEqual(slice.events[0].title, 'AuthorRegistered');
    assert.strictEqual(slice.specifications.length, 1);
    assert.strictEqual(slice.status, 'Planned');
  });

  test('a refresh keeps the fetched definition', async () => {
    const board = fakeBoard();
    await persistSlices(board, kitDir);
    await writeSliceDefinition(board, kitDir, findPlannedSlice(kitDir));
    await persistSlices(board, kitDir);
    assert.strictEqual(sliceJson().events.length, 1);
  });

  test('a slice without a definition is refused', async () => {
    const board = fakeBoard();
    await persistSlices(board, kitDir);
    await assert.rejects(writeSliceDefinition(board, kitDir, { ...findPlannedSlice(kitDir), id: 's-2' }), /no definition/);
  });

  test('each build turn names the slice to build', async () => {
    await persistSlices(fakeBoard(), kitDir);
    const request = buildRequest(findPlannedSlice(kitDir), 2, 3);
    assert.ok(request.includes('Build slice "Register Author" (id s-1) in context "Library"'));
    assert.ok(request.includes('.build-kit/.slices/library/registerauthor/slice.json'));
    assert.ok(request.includes('attempt 2 of 3'));
  });

  test('the local status is recorded in the index and slice.json', async () => {
    await persistSlices(fakeBoard(), kitDir);
    setLocalStatus(kitDir, findPlannedSlice(kitDir), 'Blocked');
    assert.strictEqual(findPlannedSlice(kitDir), null);
    assert.strictEqual(sliceJson().status, 'Blocked');
  });
});

describe('board client', () => {
  test('requests the definition by context and slice id', async () => {
    const urls = [];
    const fetchImpl = async (url) => { urls.push(url); return { ok: true, json: async () => ({ slices: [definition] }) }; };
    const board = boardClient({ baseUrl: 'https://api.test', organizationId: 'o', boardId: 'b', token: 't' }, fetchImpl);
    assert.strictEqual((await board.sliceDefinition('Library', 's-1')).events.length, 1);
    assert.strictEqual(urls[0], 'https://api.test/api/org/o/boards/b/slicedata?contextName=Library&sliceId=s-1');
  });

  test('picks the slice from either response shape', () => {
    assert.strictEqual(pickSlice({ slices: [{ id: 'x' }, definition] }, 's-1'), definition);
    assert.strictEqual(pickSlice(definition, 's-1'), definition);
    assert.strictEqual(pickSlice({ slices: [] }, 's-1'), null);
  });
});
