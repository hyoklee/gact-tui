import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ndpSearchSchema, type SourceProvider } from '@clio/core/v3';
import { connectionScope } from '@/lib/connection-scope';
import { readNdpCache, writeNdpCache } from '@/lib/ndp-cache';
import { NDPSourcePicker } from './ndp-source-picker';

const fixture = vi.hoisted(() => ({
  repository: {
    searchNdp: vi.fn(),
    ndpOrganizations: vi.fn(),
    ndpEndpointConnections: vi.fn(),
  },
}));
vi.mock('@/hooks/use-repository', () => ({ useRepository: () => fixture.repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({ settings: { endpoint: 'https://clio.test', token: '' } }),
}));
const provider: SourceProvider = {
  id: 'ndp',
  name: 'National Data Platform',
  logo: 'ndp',
  authentication: 'browser',
  configured: true,
  authenticated: true,
  account_name: 'scientist',
  setup_requirement: null,
  capabilities: { supported_modes: ['read_only'], unavailable_reasons: {} },
};
const dataset = {
  id: 'lake',
  name: 'lake',
  title: 'Saved lake observations',
  description: 'Water level measurements',
  endpoint_id: 'public',
  endpoint_name: 'Public catalog',
  access: null,
  resources: [
    {
      id: 'measurements',
      name: 'lake.csv',
      path: 'lake.csv',
      format: 'CSV',
      size: 512,
      revision: 'v1',
    },
  ],
};
const scope = connectionScope({ endpoint: 'https://clio.test', token: '' });
const catalogKey = JSON.stringify([
  'ndp-catalog',
  scope,
  'pages-v1',
  'scientist',
  false,
  '',
  '',
  '',
]);
const organizationKey = JSON.stringify(['ndp-organizations', scope, 'scientist']);
const pagesSchema = z.object({ pages: z.array(ndpSearchSchema), pageParams: z.array(z.number()) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('indexedDB', new IDBFactory());
  fixture.repository.searchNdp.mockResolvedValue({ datasets: [], warnings: [] });
  fixture.repository.ndpOrganizations.mockResolvedValue({ organizations: [] });
  fixture.repository.ndpEndpointConnections.mockResolvedValue({ endpoints: [] });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show(account = provider) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NDPSourcePicker
        workspaceId="workspace"
        provider={account}
        onBack={vi.fn()}
        onConnected={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

async function saveCatalog() {
  await writeNdpCache(
    catalogKey,
    {
      pages: [{ datasets: [dataset], warnings: [], total: 1, next_offset: null }],
      pageParams: [0],
    },
    Date.now() - 1000,
  );
}

it('restores saved pages into a fresh query client before a deferred refresh and saves changes', async () => {
  await saveCatalog();
  let finish!: (value: unknown) => void;
  fixture.repository.searchNdp.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Saved lake observations' }));
  await waitFor(() => expect(fixture.repository.searchNdp).toHaveBeenCalledOnce());
  expect(screen.getByText(/1 dataset Refreshing/)).toBeVisible();
  expect(screen.queryByLabelText('Loading datasets')).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: 'lake.csv' }));
  await act(async () =>
    finish({
      datasets: [{ ...dataset, title: 'Updated lake observations' }],
      warnings: [],
      total: 1,
      next_offset: null,
    }),
  );
  expect(await screen.findByRole('button', { name: /Updated lake observations/ })).toBeVisible();
  expect(screen.getByRole('checkbox', { name: 'lake.csv' })).toBeChecked();
  await waitFor(async () => {
    const saved = await readNdpCache(catalogKey, pagesSchema);
    expect(saved?.data.pages[0].datasets[0].title).toBe('Updated lake observations');
  });
});

it('keeps persisted datasets usable if the background refresh fails', async () => {
  await saveCatalog();
  fixture.repository.searchNdp.mockRejectedValue(new Error('Catalog is temporarily unavailable.'));
  show();
  expect(await screen.findByRole('button', { name: 'Saved lake observations' })).toBeVisible();
  expect(await screen.findByText('Showing saved results.')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('Catalog is temporarily unavailable.');
});

it('restores multiple loaded pages and refreshes their cursor chain without dropping saved rows', async () => {
  const archive = {
    ...dataset,
    id: 'archive',
    name: 'archive',
    title: 'Saved archive observations',
  };
  await writeNdpCache(
    catalogKey,
    {
      pages: [
        { datasets: [dataset], warnings: [], total: 2, next_offset: 30 },
        { datasets: [archive], warnings: [], total: 2, next_offset: null },
      ],
      pageParams: [0, 30],
    },
    Date.now() - 1000,
  );
  const pending: Array<(value: unknown) => void> = [];
  fixture.repository.searchNdp.mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  show();
  expect(await screen.findByRole('button', { name: 'Saved archive observations' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Saved lake observations' })).toBeVisible();
  await waitFor(() => expect(pending).toHaveLength(1));
  await act(async () =>
    pending[0]({
      datasets: [{ ...dataset, title: 'Fresh lake observations' }],
      warnings: [],
      total: 2,
      next_offset: 30,
    }),
  );
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(fixture.repository.searchNdp).toHaveBeenLastCalledWith(
    { query: '', only_groups: false, offset: 30 },
    expect.any(AbortSignal),
  );
  expect(screen.getByRole('button', { name: 'Saved archive observations' })).toBeVisible();
  await act(async () =>
    pending[1]({
      datasets: [{ ...archive, title: 'Fresh archive observations' }],
      warnings: [],
      total: 2,
      next_offset: null,
    }),
  );
  expect(await screen.findByRole('button', { name: 'Fresh archive observations' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Fresh lake observations' })).toBeVisible();
});

it('shows saved organizations while refreshing and retains them on failure before a successful retry', async () => {
  await writeNdpCache(
    organizationKey,
    {
      organizations: [
        { id: 'saved-publisher', endpoint_id: 'public', endpoint_name: 'Public catalog' },
      ],
    },
    Date.now() - 1000,
  );
  let fail!: (reason: Error) => void;
  fixture.repository.ndpOrganizations.mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Organization filter' }));
  expect(await screen.findByRole('option', { name: /saved-publisher/ })).toBeVisible();
  expect(await screen.findByText('Refreshing organizations…')).toBeVisible();
  await act(async () => fail(new Error('Offline')));
  expect(await screen.findByText('Could not refresh. Showing saved organizations.')).toBeVisible();
  expect(screen.getByRole('option', { name: /saved-publisher/ })).toBeVisible();
  fixture.repository.ndpOrganizations.mockResolvedValue({
    organizations: [
      { id: 'new-publisher', endpoint_id: 'public', endpoint_name: 'Public catalog' },
    ],
  });
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('option', { name: /new-publisher/ })).toBeVisible();
  expect(screen.queryByRole('option', { name: /saved-publisher/ })).not.toBeInTheDocument();
});

it('does not display another account’s persisted catalog', async () => {
  await saveCatalog();
  fixture.repository.searchNdp.mockImplementation(() => new Promise(() => undefined));
  show({ ...provider, account_name: 'other-scientist' });
  await waitFor(() => expect(fixture.repository.searchNdp).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'Saved lake observations' })).not.toBeInTheDocument();
});

it('does not restore a shared fallback identity when the signed-in account is unidentified', async () => {
  await writeNdpCache(
    JSON.stringify(['ndp-catalog', scope, 'pages-v1', 'signed-in', false, '', '', '']),
    { pages: [{ datasets: [dataset], warnings: [] }], pageParams: [0] },
    Date.now(),
  );
  fixture.repository.searchNdp.mockImplementation(() => new Promise(() => undefined));
  show({ ...provider, account_name: undefined });
  await waitFor(() => expect(fixture.repository.searchNdp).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'Saved lake observations' })).not.toBeInTheDocument();
});
