import { pluginViewEventsFromMessages, type PluginViewEvent } from '@clio/core/v3';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has no 2D canvas: the chart falls back to Vega's SVG renderer.
vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
  const measure = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.getAttribute('data-slot') === 'a2ui-chart-view') return new DOMRect(0, 0, 640, 320);
    return measure.call(this);
  };
});

const repository = vi.hoisted(() => ({
  a2uiCatalogs: vi.fn(),
  a2uiCapabilities: vi.fn(),
  pluginViewEvents: vi.fn(),
  scienceLog: vi.fn(),
}));
const embedded = vi.hoisted(() => ({ specs: [] as unknown[] }));

vi.mock('@/hooks/use-repository', () => ({ useRepository: () => repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({ settings: { endpoint: 'http://127.0.0.1:8790' } }),
}));
vi.mock('vega-embed', async (importOriginal) => {
  const original = await importOriginal<typeof import('vega-embed')>();
  return {
    ...original,
    default: async (...args: Parameters<typeof original.default>) => {
      embedded.specs.push(args[1]);
      return original.default(...args);
    },
  };
});

import {
  READINGS_CATALOG_ROW,
  READINGS_COMPONENT,
  reading,
  recordedMessage,
  viewPart,
} from '@/test-fixtures/plugin-view/plugin-view-fixtures';
import { useLiveStore } from '@/store/live-store';
import { PluginViewsSection, PluginViewsTab } from './plugin-views-panel';

const events: Record<string, PluginViewEvent[]> = {
  sess_root: pluginViewEventsFromMessages('sess_root', [
    recordedMessage('m1', 'sess_root', '2026-10-27T10:00:00Z', [
      viewPart(
        'c1',
        {
          key: 'r1',
          group: 'sess_root',
          rows: [reading(1, 'x', 1.4)],
          component: READINGS_COMPONENT,
        },
        '2026-10-27T10:00:01Z',
      ),
    ]),
  ]),
  sess_child: pluginViewEventsFromMessages('sess_child', [
    recordedMessage('m2', 'sess_child', '2026-10-27T10:02:00Z', [
      viewPart(
        'c2',
        { key: 'r1', group: 'sess_child', rows: [reading(1, 'x', 2.0)] },
        '2026-10-27T10:02:01Z',
      ),
    ]),
  ]),
};

function renderWithClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  repository.a2uiCatalogs.mockResolvedValue({ rows: [READINGS_CATALOG_ROW], rejected: [] });
  repository.a2uiCapabilities.mockResolvedValue({
    agent: { 'v0.9': { supportedCatalogIds: [READINGS_CATALOG_ROW.catalogId] } },
    client: null,
    selection: null,
  });
  repository.pluginViewEvents.mockImplementation(async (id: string) => events[id] ?? []);
  repository.scienceLog.mockResolvedValue({ session_id: 'sess_root', in_study: false });
  useLiveStore.setState((state) => ({
    entities: {
      ...state.entities,
      sessions: {
        sess_root: {
          id: 'sess_root',
          title: 'Pendulum bench',
          state: 'completed',
        } as never,
        sess_child: {
          id: 'sess_child',
          title: 'Arm sweep',
          state: 'completed',
          parent_session_id: 'sess_root',
        } as never,
      },
    },
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  embedded.specs.length = 0;
});

describe('plugin views', () => {
  it('draws a view from its tree through the catalog component and the chart kernel', async () => {
    renderWithClient(<PluginViewsTab sessionId="sess_root" />);
    const view = await screen.findByRole('region', { name: 'Bench readings' });
    expect(within(view).getByText(/2 items from 2 sessions/u)).toBeVisible();
    await waitFor(() => expect(view.querySelector('[data-slot="a2ui-chart-view"]')).not.toBeNull());
    await waitFor(() => expect(embedded.specs.length).toBeGreaterThan(0));
    const spec = JSON.stringify(embedded.specs.at(-1));
    // Both sessions' rows, each with its session's title as its branch.
    expect(spec).toContain('"branch":"Pendulum bench"');
    expect(spec).toContain('"branch":"Arm sweep"');
    expect(repository.pluginViewEvents).toHaveBeenCalledWith('sess_child', expect.anything());
  });

  it('reads only sessions whose catalogs include a plugin catalog', async () => {
    repository.a2uiCatalogs.mockImplementation(async (id: string) => ({
      rows: id === 'sess_root' ? [READINGS_CATALOG_ROW] : [],
      rejected: [],
    }));
    renderWithClient(<PluginViewsTab sessionId="sess_root" />);
    const view = await screen.findByRole('region', { name: 'Bench readings' });
    expect(within(view).getByText(/1 item from 1 session/u)).toBeVisible();
    expect(repository.pluginViewEvents).not.toHaveBeenCalledWith('sess_child', expect.anything());
  });

  it('shows nothing above a study tree until a view is recorded', async () => {
    repository.pluginViewEvents.mockResolvedValue([]);
    const { container } = renderWithClient(
      <PluginViewsSection sessionId="sess_root" sessions={[{ id: 'sess_root', title: 'Root' }]} />,
    );
    await waitFor(() => expect(repository.pluginViewEvents).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('says when a session tree has no views', async () => {
    repository.a2uiCatalogs.mockResolvedValue({ rows: [], rejected: [] });
    renderWithClient(<PluginViewsTab sessionId="sess_root" />);
    expect(
      await screen.findByText('No views have been recorded in this conversation.'),
    ).toBeVisible();
  });
});
