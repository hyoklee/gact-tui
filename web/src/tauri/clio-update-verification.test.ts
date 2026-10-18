import { beforeEach, expect, it, vi } from 'vitest';
import type { ManagedBackendHandle } from './managed-backend';
import { MANAGED_BACKEND_POLL_MS } from '@/lib/runtime-limits';

const peers = vi.hoisted(() => ({
  app: vi.fn(async () => '0.9.5-7+2'),
  backend: vi.fn<() => Promise<ManagedBackendHandle>>(async () => ({
    url: 'http://127.0.0.1:8123',
    bearer_token: 'private-test-token',
    status: { kind: 'ready' },
  })),
  capabilities: vi.fn(async () => ({ service: { version: '0.9.5b7.post2' } })),
  repository: vi.fn(),
}));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: peers.app }));
vi.mock('./managed-backend', () => ({ getManagedBackend: peers.backend }));
vi.mock('@/lib/connection', () => ({ createRepository: peers.repository }));
import { verifyClioUpdate } from './clio-update-verification';
const marker = { action: 'both' as const, version: '0.9.5-beta.7.2', startedAt: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  peers.app.mockResolvedValue('0.9.5-7+2');
  peers.backend.mockResolvedValue({
    url: 'http://127.0.0.1:8123',
    bearer_token: 'private-test-token',
    status: { kind: 'ready' },
  });
  peers.capabilities.mockResolvedValue({ service: { version: '0.9.5b7.post2' } });
  peers.repository.mockReturnValue({ capabilities: peers.capabilities });
});

it('accepts the same release in GitHub, Tauri and Python spellings', async () => {
  await expect(verifyClioUpdate(marker)).resolves.toBeUndefined();
});

it('waits for the owned runtime to start before checking its actual version', async () => {
  vi.useFakeTimers();
  try {
    peers.backend.mockResolvedValueOnce({
      url: '',
      bearer_token: '',
      status: { kind: 'starting', detail: 'starting_service' },
    });
    const verification = verifyClioUpdate(marker);
    await vi.advanceTimersByTimeAsync(MANAGED_BACKEND_POLL_MS);
    await expect(verification).resolves.toBeUndefined();
    expect(peers.capabilities).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

it('reports the local supervisor failure rather than a selected connection error', async () => {
  peers.backend.mockResolvedValueOnce({
    url: '',
    bearer_token: '',
    status: { kind: 'error', detail: 'private runtime failed to start' },
  });
  await expect(verifyClioUpdate(marker)).rejects.toThrow('private runtime failed to start');
  expect(peers.capabilities).not.toHaveBeenCalled();
});

it.each(['0.9.5b7.post1', '0.9.5b7.post3', 'unknown'])(
  'refuses a connected service at %s',
  async (version) => {
    peers.capabilities.mockResolvedValue({ service: { version } });
    await expect(verifyClioUpdate(marker)).rejects.toThrow('runtime is');
  },
);

it.each(['0.9.5-7+1', '0.9.5-7+3'])(
  'refuses an app at %s even with a matching service',
  async (version) => {
    peers.app.mockResolvedValue(version);
    await expect(verifyClioUpdate(marker)).rejects.toThrow('app is');
  },
);

it('queries the owned local service with its private credentials', async () => {
  const controller = new AbortController();
  await verifyClioUpdate(marker, controller.signal);
  expect(peers.repository).toHaveBeenCalledWith({
    endpoint: 'http://127.0.0.1:8123',
    token: 'private-test-token',
  });
  expect(peers.capabilities).toHaveBeenCalledWith(controller.signal);
});

it('does not accept a legacy agent-only marker while the app is still old', async () => {
  peers.app.mockResolvedValue('0.9.5-7+1');
  await expect(verifyClioUpdate({ ...marker, action: 'agent' })).rejects.toThrow('app is');
});

it('does not interpret a missing target as successful readiness', async () => {
  await expect(verifyClioUpdate({ ...marker, version: undefined })).rejects.toThrow(
    'target was not retained',
  );
  expect(peers.app).not.toHaveBeenCalled();
});

it('preserves a real capability failure rather than inventing a version', async () => {
  peers.capabilities.mockRejectedValueOnce(new Error('Connection reset'));
  await expect(verifyClioUpdate(marker)).rejects.toThrow('Connection reset');
});

it('stops verification when its owner has gone away', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(verifyClioUpdate(marker, controller.signal)).rejects.toThrow();
  expect(peers.backend).not.toHaveBeenCalled();
});
