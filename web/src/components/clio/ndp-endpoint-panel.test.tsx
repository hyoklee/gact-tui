import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NDPEndpointPanel } from './ndp-endpoint-panel';

const fixture = vi.hoisted(() => ({
  repository: {
    ndpEndpointConnections: vi.fn(),
    connectNdpEndpoint: vi.fn(),
    requestNdpEndpoint: vi.fn(),
    ndpEndpointCaptures: vi.fn(),
    disconnectNdpEndpoint: vi.fn(),
  },
}));
vi.mock('@/hooks/use-repository', () => ({ useRepository: () => fixture.repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({ settings: { endpoint: 'https://clio.test', token: '' } }),
}));
const endpoint = {
  id: 'ep',
  name: 'Ares',
  url: 'http://127.0.0.1:8002',
  ssh_profile: 'ares',
  authentication: 'none',
  workspace_id: 'ws',
  observed_at: '2026-10-18',
  api_title: 'NDP',
  operations: [
    {
      id: 'GET /stations',
      path: '/stations',
      method: 'GET',
      summary: 'Find stations',
      description: 'Station metadata',
      parameters: [
        { name: 'limit', in: 'query', schema: { anyOf: [{ type: 'integer' }, { type: 'null' }] } },
      ],
      body_schema: null,
      body_required: false,
      read_only: true,
    },
    {
      id: 'POST /sessions',
      path: '/sessions',
      method: 'POST',
      summary: 'Start stream',
      description: 'Create a producer',
      parameters: [],
      body_schema: { type: 'object' },
      body_required: true,
      read_only: false,
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  fixture.repository.ndpEndpointConnections.mockResolvedValue({ endpoints: [endpoint] });
  fixture.repository.connectNdpEndpoint.mockResolvedValue(endpoint);
  fixture.repository.ndpEndpointCaptures.mockResolvedValue({ captures: [] });
  fixture.repository.requestNdpEndpoint.mockResolvedValue({
    id: 'sample',
    resource_id: 'res_capture',
    status_code: 200,
    bytes_received: 15,
    events: 0,
    stop_reason: 'completed',
    sha256: '1234567890abc',
    preview: 'station,east\nA,1',
    workspace_path: '/workspace/inputs/stations.txt',
    source_artifact_id: 'artifact_capture',
  });
});
afterEach(cleanup);
function show() {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <NDPEndpointPanel workspaceId="ws" signedIn onBack={vi.fn()} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

it('runs a discovered read with typed optional parameters and an openable capture', async () => {
  show();
  await screen.findByLabelText('Endpoint operation');
  fireEvent.change(screen.getByLabelText('Endpoint operation'), {
    target: { value: 'GET /stations' },
  });
  fireEvent.change(screen.getByLabelText('limit'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run & capture' }));
  await screen.findByRole('link', { name: 'Open captured response' });
  expect(fixture.repository.requestNdpEndpoint).toHaveBeenCalledWith('ws', 'ep', {
    operation_id: 'GET /stations',
    parameters: { limit: 3 },
    max_seconds: 10,
    max_events: 100,
  });
  expect(screen.getByText(/Saved in workspace Sources/)).toBeVisible();
});
it('requires review before sending a remote state-changing request', async () => {
  show();
  await screen.findByLabelText('Endpoint operation');
  fireEvent.change(screen.getByLabelText('Endpoint operation'), {
    target: { value: 'POST /sessions' },
  });
  fireEvent.change(screen.getByLabelText('Request JSON'), {
    target: { value: '{"sncl_codes":["ANMO"]}' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review operation' }));
  expect(fixture.repository.requestNdpEndpoint).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('POST /sessions on Ares');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm operation' }));
  await waitFor(() => expect(fixture.repository.requestNdpEndpoint).toHaveBeenCalledTimes(1));
});
it('connects SSH explicitly and filters the observed operation list', async () => {
  fixture.repository.ndpEndpointConnections.mockResolvedValue({ endpoints: [] });
  show();
  await screen.findByRole('button', { name: 'SSH' });
  fireEvent.click(screen.getByRole('button', { name: 'SSH' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ares' } });
  fireEvent.change(screen.getByLabelText('SSH profile on connected computer'), {
    target: { value: 'ares' },
  });
  fireEvent.change(screen.getByLabelText('Remote API URL'), {
    target: { value: 'http://127.0.0.1:8002' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  await screen.findByLabelText('Endpoint operation');
  expect(fixture.repository.connectNdpEndpoint).toHaveBeenCalledWith('ws', {
    name: 'Ares',
    url: 'http://127.0.0.1:8002',
    ssh_profile: 'ares',
    authentication: 'none',
  });
  fireEvent.change(screen.getByLabelText('Filter endpoint operations'), {
    target: { value: 'stream' },
  });
  expect(screen.queryByRole('option', { name: 'GET · Find stations' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'POST · Start stream' })).toBeInTheDocument();
});
