import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ClioSearchAssistant } from './search-assistant';
import { vocab } from '@/lib/brand-vocabulary';

const mocks = vi.hoisted(() => ({
  repository: {
    fleetSettings: vi.fn(),
    openSearchSession: vi.fn(),
    submitMessage: vi.fn(),
    deleteSession: vi.fn(),
  },
}));
vi.mock('@/hooks/use-repository', () => ({ useRepository: () => mocks.repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({ settings: { endpoint: 'http://test' } }),
}));
vi.mock('@/hooks/use-live-session-transcript', () => ({
  useLiveSessionTranscript: () => ({
    entities: { sessions: {}, tools: {}, tasks: {}, subagents: {}, artifacts: {}, surfaces: {} },
    messages: [],
    transcript: { isPending: false },
  }),
}));
vi.mock('./conversation', () => ({ ClioConversation: () => <div>Search transcript</div> }));
const opened = {
  id: 'search_1',
  workspace_id: 'ws_current',
  state: 'completed',
  model_id: 'fleet-search-model',
};
beforeEach(() => {
  mocks.repository.fleetSettings.mockResolvedValue({
    search: { provider_id: 'local', model_id: 'fleet-search-model' },
  });
  mocks.repository.openSearchSession.mockResolvedValue(opened);
  mocks.repository.submitMessage.mockResolvedValue({});
  mocks.repository.deleteSession.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function show() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <ClioSearchAssistant
          workspaceId="ws_current"
          parentSessionId="parent_1"
          query="Where did we discuss the plant?"
          onQueryChange={vi.fn()}
          onBack={vi.fn()}
          onClose={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it('starts only on submit, inherits its server-selected route, and deletes only its temporary chat', async () => {
  const view = show();
  expect(mocks.repository.openSearchSession).not.toHaveBeenCalled();
  expect(await screen.findByText('fleet-search-model')).toBeVisible();
  await userEvent.setup().click(screen.getByRole('button', { name: `Search with ${vocab.agent}` }));
  await waitFor(() =>
    expect(mocks.repository.submitMessage).toHaveBeenCalledWith(
      'search_1',
      expect.objectContaining({
        parts: [{ type: 'text', text: 'Where did we discuss the plant?' }],
      }),
    ),
  );
  expect(mocks.repository.openSearchSession).toHaveBeenCalledWith({
    workspace_id: 'ws_current',
    parent_session_id: 'parent_1',
  });
  expect(mocks.repository.submitMessage.mock.calls[0][1]).not.toHaveProperty('model');
  view.unmount();
  expect(mocks.repository.deleteSession).toHaveBeenCalledWith('search_1');
  expect(mocks.repository.deleteSession).not.toHaveBeenCalledWith('parent_1');
});
it('retires a late-created search if the person closed it before creation returned', async () => {
  let resolve!: (value: typeof opened) => void;
  mocks.repository.openSearchSession.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const view = show();
  await userEvent.setup().click(screen.getByRole('button', { name: `Search with ${vocab.agent}` }));
  view.unmount();
  await act(async () => {
    resolve(opened);
  });
  expect(mocks.repository.deleteSession).toHaveBeenCalledWith('search_1');
  expect(mocks.repository.submitMessage).not.toHaveBeenCalled();
});
it('shows the actual connection failure and retains the question for retry', async () => {
  mocks.repository.openSearchSession.mockRejectedValue(new Error('Search blueprint unavailable'));
  show();
  await userEvent.setup().click(screen.getByRole('button', { name: `Search with ${vocab.agent}` }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Search blueprint unavailable');
  expect(screen.getByRole('textbox')).toHaveValue('Where did we discuss the plant?');
});

it('identifies an older service before offering a search request', async () => {
  mocks.repository.fleetSettings.mockResolvedValue({
    judges: { goals: null, variants: null, permissions: null },
  });
  show();
  expect(
    await screen.findByText(
      'Search is unavailable on this connection. Update its agent to enable it.',
    ),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: `Search with ${vocab.agent}` })).toBeDisabled();
  expect(mocks.repository.openSearchSession).not.toHaveBeenCalled();
});
