import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { readNdpCache, writeNdpCache } from './ndp-cache';

const schema = z.object({ names: z.array(z.string()) });
const now = Date.now();

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('persists validated metadata independently of the in-memory query client', async () => {
  await writeNdpCache('connection/account/query/offset', { names: ['Lake observations'] }, now);
  expect(await readNdpCache('connection/account/query/offset', schema)).toEqual({
    data: { names: ['Lake observations'] },
    updatedAt: now,
  });
  expect(await readNdpCache('other-connection/account/query/offset', schema)).toBeUndefined();
  expect(await readNdpCache('connection/other-account/query/offset', schema)).toBeUndefined();
  expect(await readNdpCache('connection/account/other-query/offset', schema)).toBeUndefined();
});

it('replaces snapshots after a successful refresh, including an empty result', async () => {
  await writeNdpCache('query', { names: ['Old result'] }, now - 1000);
  await writeNdpCache('query', { names: [] }, now);
  expect((await readNdpCache('query', schema))?.data.names).toEqual([]);
});

it('discards incompatible metadata and expired results', async () => {
  await writeNdpCache('invalid', { datasets: 'old-schema' }, now);
  await writeNdpCache('expired', { names: ['Old result'] }, now - 8 * 24 * 60 * 60 * 1000);
  expect(await readNdpCache('invalid', schema)).toBeUndefined();
  expect(await readNdpCache('expired', schema)).toBeUndefined();
});

it('evicts the oldest entries while retaining twenty recent query snapshots', async () => {
  for (let index = 0; index < 21; index++) {
    await writeNdpCache(`query-${index}`, { names: [`Result ${index}`] }, now - 30 + index);
  }
  expect(await readNdpCache('query-0', schema)).toBeUndefined();
  expect((await readNdpCache('query-1', schema))?.data.names).toEqual(['Result 1']);
  expect((await readNdpCache('query-20', schema))?.data.names).toEqual(['Result 20']);
});

it('bounds total payload bytes without discarding the most recent metadata', async () => {
  const names = ['x'.repeat(7 * 1024 * 1024)];
  for (let index = 0; index < 5; index++) {
    await writeNdpCache(`large-${index}`, { names }, now - 5 + index);
  }
  expect(await readNdpCache('large-0', schema)).toBeUndefined();
  expect((await readNdpCache('large-4', schema))?.data.names[0].length).toBe(names[0].length);
});

it('keeps the previous snapshot when an oversized update cannot be cached', async () => {
  await writeNdpCache('query', { names: ['Last good result'] }, now - 1);
  await writeNdpCache('query', { names: ['λ'.repeat(5 * 1024 * 1024)] }, now);
  expect((await readNdpCache('query', schema))?.data.names).toEqual(['Last good result']);
});

it('treats unavailable browser storage as a cache miss rather than an application error', async () => {
  vi.stubGlobal('indexedDB', {
    open: () => {
      throw new DOMException('Storage blocked', 'SecurityError');
    },
  });
  expect(await readNdpCache('query', schema)).toBeUndefined();
  await expect(writeNdpCache('query', { names: [] }, now)).resolves.toBeUndefined();
});
