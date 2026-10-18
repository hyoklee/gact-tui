import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NDPEndpointConnection } from '@clio/core/v3';
import { NDPEndpointBrowser } from './ndp-endpoint-browser';

const fixture = vi.hoisted(() => ({
  repository: {
    browseNdpEndpoint: vi.fn(),
    requestNdpEndpoint: vi.fn(),
    ndpEndpointCaptures: vi.fn(),
  },
}));
vi.mock('@/hooks/use-repository', () => ({ useRepository: () => fixture.repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({ settings: { endpoint: 'https://clio.test', token: '' } }),
}));
const operation = (id: string, extra = {}) => ({
  id,
  method: id.split(' ')[0],
  path: id.split(' ')[1],
  summary: id,
  description: '',
  parameters: [],
  body_schema: null,
  body_required: false,
  read_only: id.startsWith('GET'),
  ...extra,
});
const endpoint: NDPEndpointConnection = {
  id: 'ep',
  name: 'Lab',
  url: 'https://ndp.test',
  ssh_profile: '',
  authentication: 'none',
  workspace_id: 'w',
  observed_at: 'today',
  api_title: 'NDP',
  operations: [
    operation('GET /search'),
    operation('GET /organization'),
    operation('POST /organization', {
      body_schema: {
        type: 'object',
        required: ['name', 'title'],
        properties: {
          name: { type: 'string', title: 'Name' },
          title: { type: 'string', title: 'Title' },
        },
      },
      body_required: true,
    }),
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  fixture.repository.browseNdpEndpoint.mockImplementation(async (_w, _id, request) =>
    request.operation_id === 'GET /organization'
      ? ['earthscope', 'ocean']
      : [
          {
            id: 'd',
            title: 'Coastal observations',
            name: 'coastal',
            resources: [
              {
                id: 'r',
                name: 'stations.csv',
                format: 'CSV',
                url: 'https://data.test/stations.csv',
              },
            ],
          },
        ],
  );
  fixture.repository.ndpEndpointCaptures.mockResolvedValue({ captures: [] });
  fixture.repository.requestNdpEndpoint.mockResolvedValue({
    id: 'c',
    status_code: 200,
    bytes_received: 2,
    events: 0,
    stop_reason: 'completed',
    sha256: 'abc',
    preview: '{}',
  });
});
afterEach(cleanup);
function show(current = endpoint) {
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <NDPEndpointBrowser workspaceId="w" endpoint={current} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

it('loads catalog records automatically, filters data live, and keeps HTTP methods under Advanced', async () => {
  show();
  expect(await screen.findByText('Coastal observations')).toBeVisible();
  expect(fixture.repository.browseNdpEndpoint).toHaveBeenCalledWith(
    'w',
    'ep',
    { operation_id: 'GET /search', parameters: { terms: [''], server: 'local' } },
    expect.any(AbortSignal),
  );
  expect(screen.queryByLabelText('Search endpoint actions')).not.toBeVisible();
  await userEvent.type(screen.getByLabelText('Search catalog'), 'coast');
  await waitFor(() =>
    expect(fixture.repository.browseNdpEndpoint).toHaveBeenLastCalledWith(
      'w',
      'ep',
      { operation_id: 'GET /search', parameters: { terms: ['coast'], server: 'local' } },
      expect.any(AbortSignal),
    ),
  );
  expect(fixture.repository.requestNdpEndpoint).not.toHaveBeenCalled();
});

it('lists organizations and creates one from the plus button with a typed review', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Organizations' }));
  expect(await screen.findByText('earthscope')).toBeVisible();
  await userEvent.type(screen.getByLabelText('Search organizations'), 'ocean');
  expect(screen.queryByText('earthscope')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Create organization' }));
  await userEvent.type(screen.getByLabelText('Name *'), 'test-ocean');
  await userEvent.type(screen.getByLabelText('Title *'), 'Ocean research');
  expect(screen.queryByLabelText('Request JSON')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Review' }));
  expect(fixture.repository.requestNdpEndpoint).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Create organization on Lab?');
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() =>
    expect(fixture.repository.requestNdpEndpoint).toHaveBeenCalledWith('w', 'ep', {
      operation_id: 'POST /organization',
      parameters: { server: 'local' },
      body: { name: 'test-ocean', title: 'Ocean research' },
      max_seconds: 10,
      max_events: 100,
    }),
  );
});

it('shows stations as data and preselects their codes without starting a producer', async () => {
  fixture.repository.browseNdpEndpoint.mockResolvedValue({
    stations: ['WWMT.CI.LY_.40', 'ANMO.IU'],
  });
  show({
    ...endpoint,
    operations: [
      operation('GET /bridge/stations/catalog'),
      operation('POST /bridge/sessions', {
        body_schema: {
          type: 'object',
          properties: { sncl_codes: { type: 'array', items: { type: 'string' } } },
        },
      }),
    ],
  });
  expect(await screen.findByText('WWMT.CI.LY_.40')).toBeVisible();
  await userEvent.click(screen.getAllByRole('button', { name: 'Start stream' })[1]);
  expect(screen.getByLabelText('Station codes')).toHaveValue('WWMT.CI.LY_.40');
  expect(fixture.repository.requestNdpEndpoint).not.toHaveBeenCalled();
});

it('reports unavailable endpoint data as a failure rather than an empty collection', async () => {
  fixture.repository.browseNdpEndpoint.mockRejectedValue(new Error('Endpoint access denied'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Endpoint access denied');
  expect(screen.queryByText('No catalog returned by this Endpoint.')).not.toBeInTheDocument();
});

it('queries an FDSN service through Network and Station fields', async () => {
  fixture.repository.browseNdpEndpoint.mockResolvedValue([
    {
      name: 'fdsn-station',
      title: 'FDSN Station Service',
      extras: { service_type: 'FDSN Station API' },
    },
  ]);
  show({
    ...endpoint,
    operations: [
      ...endpoint.operations,
      operation('GET /services/redirect/{service_identifier}/{path}', {
        parameters: [
          { name: 'service_identifier', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'path', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'query', in: 'query-map', schema: { type: 'object' } },
        ],
      }),
    ],
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Query service' }));
  await userEvent.type(screen.getByLabelText('Network'), 'IU');
  await userEvent.type(screen.getByLabelText('Station'), 'ANMO');
  await userEvent.click(screen.getByRole('button', { name: 'Save sample' }));
  await waitFor(() =>
    expect(fixture.repository.requestNdpEndpoint).toHaveBeenCalledWith(
      'w',
      'ep',
      expect.objectContaining({
        parameters: {
          service_identifier: 'fdsn-station',
          path: 'query',
          query: { net: 'IU', sta: 'ANMO', level: 'station', format: 'text' },
        },
      }),
    ),
  );
});

it('keeps dataset resources as structured objects through the creation form', async () => {
  show({
    ...endpoint,
    operations: [
      ...endpoint.operations,
      operation('POST /dataset', {
        body_schema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', title: 'Name' },
            resources: {
              anyOf: [
                {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['url', 'name'],
                    properties: {
                      url: { type: 'string', title: 'URL' },
                      name: { type: 'string', title: 'Resource name' },
                    },
                  },
                },
                { type: 'null' },
              ],
            },
          },
        },
      }),
    ],
  });
  await userEvent.click(screen.getByRole('button', { name: 'Create dataset' }));
  await userEvent.type(screen.getByLabelText('Name *'), 'coast');
  await userEvent.click(screen.getByText('Options', { exact: true }));
  await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  await userEvent.type(screen.getByLabelText('URL'), 'https://data.test/stations.csv');
  await userEvent.type(screen.getByLabelText('Resource name'), 'Stations');
  await userEvent.click(screen.getByRole('button', { name: 'Review' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() =>
    expect(fixture.repository.requestNdpEndpoint).toHaveBeenCalledWith(
      'w',
      'ep',
      expect.objectContaining({
        body: {
          name: 'coast',
          resources: [{ url: 'https://data.test/stations.csv', name: 'Stations' }],
        },
      }),
    ),
  );
});
