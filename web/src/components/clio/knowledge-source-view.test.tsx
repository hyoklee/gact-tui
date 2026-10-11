import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KnowledgeSourceView } from './knowledge-source-view';
import { KNOWLEDGE_ATTACH_EVENT } from '@/lib/knowledge-navigation';

const repository = vi.hoisted(() => ({
  knowledgeSnapshot: vi.fn(),
  connectedSources: vi.fn(),
  knowledgeOpen: vi.fn(),
  knowledgeSync: vi.fn(),
}));
vi.mock('@/hooks/use-repository', () => ({ useRepository: () => repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({ settings: { endpoint: 'https://test' } }),
}));
vi.mock('./knowledge-graph', () => ({
  KnowledgeGraph: ({
    snapshot,
    onSelect,
  }: {
    snapshot: { notes: { path: string }[] };
    onSelect: (path: string) => void;
  }) => (
    <div aria-label="Test graph">
      {snapshot.notes.map((note) => (
        <button key={note.path} onClick={() => onSelect(note.path)}>
          Graph {note.path}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('./markdown-file-preview', () => ({
  MarkdownFilePreview: ({ content }: { content: string }) => <article>{content}</article>,
}));
vi.mock('./workspace-resource-view', () => ({
  WorkspaceResourceCarousel: () => <p>Attachment preview</p>,
}));

afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  repository.connectedSources.mockResolvedValue([
    { id: 'vault', source_kind: 'knowledge', connection: 'local_vault', link_access: 'read_only' },
  ]);
  repository.knowledgeSnapshot.mockResolvedValue({
    source_id: 'vault',
    revision: 'index1',
    state: 'ready',
    total: 2,
    offset: 0,
    next_offset: null,
    truncated: false,
    warnings: [],
    notes: [
      { path: 'a.md', title: 'Alpha', kind: 'note', revision: 'a1' },
      { path: 'b.md', title: 'Beta', kind: 'note', revision: 'b1' },
    ],
    links: [
      { source: 'a.md', target: 'b.md', status: 'resolved', kind: 'link', selector: 'Topic' },
    ],
  });
  repository.knowledgeOpen.mockImplementation((_wid: string, _sid: string, path: string) =>
    Promise.resolve({
      source_id: 'vault',
      note: { path, title: path === 'a.md' ? 'Alpha' : 'Beta', kind: 'note', revision: 'notehash' },
      text: `Content of ${path}`,
      properties: {},
      links: [
        { source: 'a.md', target: 'b.md', status: 'resolved', kind: 'link', selector: 'Topic' },
      ],
      resource: {
        id: `resource:${path}`,
        workspace_id: 'w',
        name: path,
        revision: 1,
        detected_mime: 'text/markdown',
      },
      access: 'read_only',
      link_revision: 'link1',
    }),
  );
});

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <KnowledgeSourceView workspaceId="w" sourceId="vault" />
    </QueryClientProvider>,
  );
}

it('keeps selection across graph/list, follows authored links and attaches the captured revision', async () => {
  renderView();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Graph a.md' }));
  expect(await screen.findByText('Content of a.md')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Files' }));
  expect(screen.getByText('Content of a.md')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open a.md' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: '→ b.md#Topic' }));
  expect(await screen.findByText('Content of b.md')).toBeInTheDocument();
  const attached = vi.fn();
  window.addEventListener(KNOWLEDGE_ATTACH_EVENT, attached);
  await user.click(screen.getByRole('button', { name: 'Attach note' }));
  expect(attached.mock.calls[0][0].detail).toMatchObject({
    workspaceId: 'w',
    resource: { id: 'resource:b.md', revision: 1 },
  });
  window.removeEventListener(KNOWLEDGE_ATTACH_EVENT, attached);
  await user.click(screen.getByRole('button', { name: 'Explore links' }));
  await waitFor(() =>
    expect(repository.knowledgeSnapshot.mock.calls.at(-1)?.[2]).toMatchObject({ focus: 'b.md' }),
  );
});

it('shows index and reader failures without fabricating note contents', async () => {
  repository.knowledgeOpen.mockRejectedValue(new Error('Source disconnected'));
  renderView();
  await userEvent.click(await screen.findByRole('button', { name: 'Graph a.md' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Source disconnected');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
