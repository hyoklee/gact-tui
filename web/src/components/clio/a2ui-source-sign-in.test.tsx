import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { vocab } from '@/lib/brand-vocabulary';
import { A2uiSourceSignIn, A2uiSourceSignInHost } from './a2ui-source-sign-in';
import { useSourceSignIn } from '@/lib/a2ui/source-sign-in-context';
import { PresentationNavigation } from './presentation-navigation';
const repository = vi.hoisted(() => ({ storageProviders: vi.fn() }));
const lifecycle = vi.hoisted(() => ({ mounted: vi.fn(), unmounted: vi.fn() }));
vi.mock('@/hooks/use-repository', () => ({ useRepository: () => repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({ settings: { endpoint: 'http://127.0.0.1:8100' } }),
}));
vi.mock('./connected-source-auth', () => ({
  ConnectedAccountSignIn: ({ provider }: { provider: string }) => {
    useEffect(() => {
      lifecycle.mounted();
      return () => lifecycle.unmounted();
    }, []);
    return <p>Private {provider} authorization</p>;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  repository.storageProviders.mockResolvedValue({
    clio_id: 'c',
    providers: [{ id: 'google_drive', name: 'Google Drive', configured: true }],
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function mount(workspace = 'w') {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <PresentationNavigation.Provider
        value={{ artifacts: {}, resources: {}, subagents: {}, workspaceId: workspace }}
      >
        <A2uiSourceSignIn
          intent={{ provider: 'google_drive', clioId: 'c', workspaceId: 'w' }}
          onClose={vi.fn()}
        />
      </PresentationNavigation.Provider>
    </QueryClientProvider>,
  );
  return client;
}
it('checks the connected host before mounting existing private authorization', async () => {
  mount();
  expect(await screen.findByText('Private google_drive authorization')).toBeVisible();
});
it('keeps the receiver owner mounted during a background connection recheck', async () => {
  const client = mount();
  expect(await screen.findByText('Private google_drive authorization')).toBeVisible();
  let finish!: (value: unknown) => void;
  repository.storageProviders.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let refreshed!: Promise<void>;
  await act(async () => {
    refreshed = client.invalidateQueries({ queryKey: ['a2ui-source-login'] });
  });
  expect(await screen.findByRole('status')).toHaveTextContent('Checking this connection');
  expect(screen.getByText('Private google_drive authorization')).toBeVisible();
  expect(lifecycle.mounted).toHaveBeenCalledTimes(1);
  expect(lifecycle.unmounted).not.toHaveBeenCalled();
  await act(async () => {
    finish({
      clio_id: 'c',
      providers: [{ id: 'google_drive', name: 'Google Drive', configured: true }],
    });
    await refreshed;
  });
  expect(lifecycle.mounted).toHaveBeenCalledTimes(1);
  expect(lifecycle.unmounted).not.toHaveBeenCalled();
});

it('cancels authorization when a completed recheck detects a different owner', async () => {
  const client = mount();
  expect(await screen.findByText('Private google_drive authorization')).toBeVisible();
  repository.storageProviders.mockResolvedValueOnce({ clio_id: 'foreign', providers: [] });
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['a2ui-source-login'] });
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be checked');
  await waitFor(() => expect(lifecycle.unmounted).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('Private google_drive authorization')).toBeNull();
});
it('rejects another workspace before fetching account state', () => {
  mount('foreign');
  expect(screen.getByRole('alert')).toHaveTextContent('Open the original workspace');
  expect(repository.storageProviders).not.toHaveBeenCalled();
});
it('rejects a host owner change', async () => {
  repository.storageProviders.mockResolvedValue({ clio_id: 'foreign', providers: [] });
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be checked');
  expect(screen.queryByText('Private google_drive authorization')).toBeNull();
});
it('explains an unconfigured provider without mounting authorization', async () => {
  repository.storageProviders.mockResolvedValue({
    clio_id: 'c',
    providers: [{ id: 'google_drive', name: 'Google Drive', configured: false }],
  });
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent(`unavailable on this ${vocab.agent}`);
  expect(screen.queryByText('Private google_drive authorization')).toBeNull();
});

it('keeps private authorization open when the initiating surface unmounts', async () => {
  function MovingSurface() {
    const signIn = useSourceSignIn();
    const [visible, setVisible] = useState(true);
    return visible ? (
      <button
        onClick={() => {
          signIn?.({ provider: 'google_drive', clioId: 'c', workspaceId: 'w' });
          setVisible(false);
        }}
      >
        Sign in
      </button>
    ) : (
      <p>Surface moved into the transcript</p>
    );
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <A2uiSourceSignInHost workspaceId="w">
        <MovingSurface />
      </A2uiSourceSignInHost>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByText('Surface moved into the transcript')).toBeVisible();
  expect(await screen.findByText('Private google_drive authorization')).toBeVisible();
  expect(screen.getByRole('dialog')).toBeVisible();
});
