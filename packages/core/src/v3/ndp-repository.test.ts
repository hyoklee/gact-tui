import { expect, it } from 'vitest';
import { ClioRepository } from './repository.js';
import { RecordingTransport } from './recording-transport.test-helper.js';

const endpoint = {
  id: 'ep',
  name: 'Lab',
  url: 'https://ndp.test/api',
  ssh_profile: '',
  authentication: 'none',
  workspace_id: 'w',
  observed_at: '2026-10-18',
  api_title: 'Lab API',
  operations: [],
  hidden: true,
};

it('lists hidden endpoints explicitly and patches the existing connection with only requested edits', async () => {
  const transport = new RecordingTransport([{ endpoints: [endpoint] }, endpoint]);
  const repository = new ClioRepository(transport);
  expect(
    (await repository.ndpEndpointConnections('workspace/one', undefined, true)).endpoints,
  ).toEqual([endpoint]);
  expect(await repository.updateNdpEndpoint('workspace/one', 'ep/one', { hidden: true })).toEqual(
    endpoint,
  );
  expect(transport.requests).toMatchObject([
    { method: 'GET', path: '/v1/workspaces/workspace%2Fone/ndp-endpoints?include_hidden=true' },
    {
      method: 'PATCH',
      path: '/v1/workspaces/workspace%2Fone/ndp-endpoints/ep%2Fone',
      body: { hidden: true },
    },
  ]);
});

it('passes catalog offsets and retains page totals and continuation', async () => {
  const page = { datasets: [], warnings: [], total: 6235, next_offset: 60 };
  const transport = new RecordingTransport([page]);
  const repository = new ClioRepository(transport);
  expect(await repository.searchNdp({ query: '', offset: 30 })).toEqual(page);
  expect(transport.requests).toMatchObject([
    { method: 'POST', path: '/v1/storage/ndp/search', body: { query: '', offset: 30 } },
  ]);
});
