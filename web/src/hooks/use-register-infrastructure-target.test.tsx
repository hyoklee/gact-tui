import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useRegisterInfrastructureTarget } from './use-register-infrastructure-target';
import { useInfrastructureTargetSelection } from './use-infrastructure-target-selection';
import { infrastructureTargetSchema } from '@clio/core/v3';

const repository = vi.hoisted(() => ({
  infrastructureTargets: vi.fn(),
  updateInfrastructureTarget: vi.fn(),
  createInfrastructureTarget: vi.fn(),
  setInfrastructureTransportState: vi.fn(),
}));
const attach = vi.hoisted(() => vi.fn());
vi.mock('./use-repository', () => ({ useRepository: () => repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({
    settings: { endpoint: 'http://agent', token: 'test-token' },
    isManagedConnection: true,
  }),
}));
vi.mock('@/tauri/ssh-infrastructure-transport', () => ({
  attachInfrastructureSshTransport: attach,
}));
const host = { id: 'saved', label: 'Homelab', profile: 'homelab', port: 22 };
vi.mock('@/lib/transport/tauri-runtime', () => ({ inTauri: () => true }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));
const registered = {
  id: 'homelab',
  kind: 'ssh',
  label: 'Homelab',
  install_root: '/owned-root',
  ssh: { profile: 'homelab' },
};
function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useRegisterInfrastructureTarget(), { wrapper }), invalidate };
}
beforeEach(() => {
  vi.clearAllMocks();
  repository.infrastructureTargets.mockResolvedValue([registered]);
  repository.updateInfrastructureTarget.mockResolvedValue(registered);
  repository.setInfrastructureTransportState.mockResolvedValue(undefined);
  attach.mockResolvedValue({ state: 'connected', session_id: 'owned-session' });
});
it('refreshes authoritative targets and reuses the existing route instead of creating a duplicate', async () => {
  const { result, invalidate } = setup();
  await act(async () => {
    await result.current.mutateAsync(host);
  });
  expect(repository.infrastructureTargets).toHaveBeenCalledOnce();
  expect(repository.createInfrastructureTarget).not.toHaveBeenCalled();
  expect(repository.updateInfrastructureTarget).toHaveBeenCalledWith(
    'homelab',
    expect.objectContaining({
      install_root: '/owned-root',
      ssh: expect.objectContaining({ platform: 'auto', profile: 'homelab' }),
    }),
  );
  expect(attach).toHaveBeenCalledWith('http://agent', 'test-token', registered);
  expect(repository.setInfrastructureTransportState).toHaveBeenCalledWith('homelab', 'connected');
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['infrastructure-inventory', 'http://agent'],
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['managed-service-catalog', 'http://agent', 'homelab'],
  });
});
it('keeps an attachment failure visible and allows an explicit retry of the same computer', async () => {
  attach.mockRejectedValueOnce(new Error('SSH connection refused'));
  const { result } = setup();
  await act(async () => {
    await expect(result.current.mutateAsync(host)).rejects.toThrow('SSH connection refused');
  });
  expect(result.current.error?.message).toBe('SSH connection refused');
  expect(repository.setInfrastructureTransportState).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.mutateAsync(host);
  });
  await waitFor(() => expect(result.current.error).toBeNull());
  expect(repository.createInfrastructureTarget).not.toHaveBeenCalled();
});

it('refreshes inspection when selecting a host finishes attaching its transport', async () => {
  const targets = [
    infrastructureTargetSchema.parse({
      ...registered,
      transport_state: 'disconnected',
      created_at: '',
      updated_at: '',
    }),
  ];
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useInfrastructureTargetSelection(targets), { wrapper });
  act(() => result.current.selectTarget('homelab'));
  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['managed-service-catalog', 'http://agent', 'homelab'],
    }),
  );
  expect(repository.setInfrastructureTransportState).toHaveBeenCalledWith('homelab', 'connected');
});
