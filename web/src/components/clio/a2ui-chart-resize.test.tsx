import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { View } from 'vega';
import type { Result } from 'vega-embed';

vi.hoisted(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
const repository = vi.hoisted(() => ({
  artifactTableExport: vi.fn(),
  artifactTableQuery: vi.fn(),
}));
const embedded = vi.hoisted(() => ({ views: [] as View[] }));
vi.mock('@/hooks/use-repository', () => ({ useRepository: () => repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({ settings: { endpoint: 'http://127.0.0.1:8790' } }),
}));
// Keep the real Vega renderer and observe its view identity across React updates.
vi.mock('vega-embed', async (importOriginal) => {
  const original = await importOriginal<typeof import('vega-embed')>();
  return {
    ...original,
    default: async (...args: Parameters<typeof original.default>): Promise<Result> => {
      const result = await original.default(...args);
      embedded.views.push(result.view);
      return result;
    },
  };
});
import { ClioChart } from './a2ui-chart';
const ROWS = [
  { t: 0, v: 1.5 },
  { t: 1, v: 2.4 },
];
function wrap(children: ReactNode) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}
async function embeddedView(): Promise<View> {
  await waitFor(() => expect(embedded.views.length).toBeGreaterThan(0));
  return embedded.views.at(-1)!;
}
afterEach(() => {
  cleanup();
  embedded.views = [];
  vi.clearAllMocks();
});

describe('ClioChart responsive lifecycle', () => {
  it('reacts to container resizing without replacing a composed view or resetting its controls', async () => {
    let width = 640;
    const measure = HTMLElement.prototype.getBoundingClientRect;
    const originalHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const callbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          callbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    HTMLElement.prototype.getBoundingClientRect = function () {
      return this.getAttribute('data-slot') === 'a2ui-chart-view'
        ? new DOMRect(0, 0, width, 320)
        : measure.call(this);
    };
    try {
      const panel = {
        mark: 'point',
        height: 120,
        encoding: {
          x: { field: 't', type: 'quantitative' },
          y: { field: 'v', type: 'quantitative' },
        },
      };
      render(
        wrap(
          <ClioChart
            componentId="composed-resize"
            data={ROWS}
            spec={{ params: [{ name: 'cutoff', value: 1 }], vconcat: [panel, panel] }}
          />,
        ),
      );
      const view = await embeddedView();
      view.signal('cutoff', 50);
      await view.runAsync();
      for (const next of [1050, 420, 800]) {
        width = next;
        await act(async () => {
          for (const callback of callbacks) callback([], {} as ResizeObserver);
        });
        await waitFor(() => {
          const svg = document.querySelector('[data-slot="a2ui-chart-view"] svg');
          expect(Number(svg?.getAttribute('width'))).toBeGreaterThanOrEqual(next - 4);
          expect(Number(svg?.getAttribute('width'))).toBeLessThanOrEqual(next + 4);
        });
        expect(embedded.views).toEqual([view]);
        expect(view.signal('cutoff')).toBe(50);
      }
      fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
      await waitFor(() => expect(embedded.views).toHaveLength(2));
      const fullscreenView = embedded.views[1]!;
      fullscreenView.signal('cutoff', 75);
      await fullscreenView.runAsync();
      Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
      await act(async () => {
        window.dispatchEvent(new Event('resize'));
      });
      await waitFor(() => {
        const svg = document.querySelector('[data-slot="a2ui-chart-view"] svg');
        expect(Number(svg?.getAttribute('height'))).toBeGreaterThanOrEqual(816);
        expect(Number(svg?.getAttribute('height'))).toBeLessThanOrEqual(824);
      });
      expect(embedded.views).toHaveLength(2);
      expect(fullscreenView.signal('cutoff')).toBe(75);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = measure;
      if (originalHeight) Object.defineProperty(window, 'innerHeight', originalHeight);
      vi.unstubAllGlobals();
    }
  });
});
