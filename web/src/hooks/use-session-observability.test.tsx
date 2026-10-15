import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  asyncProcessesPage: vi.fn(),
  sessionAgentTasks: vi.fn(),
  sessionDiffs: vi.fn().mockResolvedValue([]),
  contextFiles: vi.fn().mockResolvedValue([]),
  contextFrames: vi.fn().mockResolvedValue([]),
}));
vi.mock('./use-repository', () => ({ useRepository: () => repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({ settings: { endpoint: 'http://service' } }),
}));
import { useSessionObservability } from './use-session-observability';

afterEach(cleanup);

it('uses one bounded active-work read and retains empty-page continuation', async () => {
  repository.asyncProcessesPage
    .mockReset()
    .mockResolvedValueOnce({ items: [], cursor: 'next', total: null, revision: 1 })
    .mockResolvedValueOnce({
      items: [{ handle: 'child-handle' }],
      cursor: null,
      total: null,
      revision: 2,
    });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useSessionObservability('sess'), { wrapper });
  try {
    await waitFor(() => expect(result.current.processes.isSuccess).toBe(true));
    expect(result.current.processes.hasNextPage).toBe(true);
    expect(repository.asyncProcessesPage).toHaveBeenCalledTimes(1);
    expect(repository.asyncProcessesPage).toHaveBeenLastCalledWith(
      'sess',
      { cursor: undefined, activeOnly: true },
      expect.any(AbortSignal),
    );
    await act(async () => {
      await result.current.processes.fetchNextPage();
    });
    expect(result.current.processes.data?.pages.flatMap((page) => page.items)).toEqual([
      { handle: 'child-handle' },
    ]);
    expect(result.current.processes.hasNextPage).toBe(false);
    expect(repository.asyncProcessesPage).toHaveBeenCalledTimes(2);
    expect(repository.asyncProcessesPage).toHaveBeenLastCalledWith(
      'sess',
      { cursor: 'next', activeOnly: true },
      expect.any(AbortSignal),
    );
    expect(repository.sessionAgentTasks).not.toHaveBeenCalled();
  } finally {
    unmount();
    client.clear();
  }
});
