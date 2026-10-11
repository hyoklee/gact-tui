import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { KnowledgeGraph } from './knowledge-graph';
import type { KnowledgeGraphLayout } from '@/lib/knowledge-graph-layout';

class LayoutWorker {
  static instances: LayoutWorker[] = [];
  onmessage?: (event: MessageEvent<{ graph: KnowledgeGraphLayout }>) => void;
  onerror?: () => void;
  topology?: KnowledgeGraphLayout;
  terminate = vi.fn();
  constructor() {
    LayoutWorker.instances.push(this);
  }
  postMessage(topology: KnowledgeGraphLayout) {
    this.topology = topology;
  }
  complete() {
    const graph = {
      ...this.topology!,
      nodes: this.topology!.nodes.map((node, i) => ({
        ...node,
        x: i ? 200 : -200,
        y: i ? 100 : -100,
      })),
    };
    this.onmessage?.(new MessageEvent('message', { data: { graph } }));
  }
}
let resize: (width: number, height: number) => void;
beforeEach(() => {
  LayoutWorker.instances = [];
  vi.stubGlobal('Worker', LayoutWorker);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = (width, height) =>
          callback(
            [{ contentRect: { width, height } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const snapshot = {
  source_id: 's',
  revision: '1',
  state: 'ready' as const,
  total: 2,
  offset: 0,
  next_offset: null,
  truncated: false,
  relationships_truncated: false,
  warnings: [],
  notes: ['a', 'b'].map((path) => ({
    path,
    title: path,
    kind: 'note' as const,
    revision: '1',
    tags: [],
    aliases: [],
    headings: [],
    blocks: [],
    excerpt: '',
  })),
  links: [
    {
      source: 'a',
      target: 'b',
      kind: 'link' as const,
      status: 'resolved' as const,
      selector: '',
      candidates: [],
    },
  ],
};
function camera() {
  const transform = screen
    .getByLabelText('2 notes, 1 connections')
    .querySelector('g')!
    .getAttribute('transform')!;
  const [x, y, scale] = transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  return { x, y, scale };
}

it('keeps initial framing visible when a reader narrows the canvas, preserving manual zoom and geometry', () => {
  const onSelect = vi.fn();
  const { rerender } = render(
    <KnowledgeGraph snapshot={snapshot} selected="" onSelect={onSelect} />,
  );
  act(() => {
    resize(1000, 600);
    LayoutWorker.instances[0].complete();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Open a, 1 linked notes' }));
  expect(onSelect).toHaveBeenCalledWith('a');
  rerender(<KnowledgeGraph snapshot={snapshot} selected="a" onSelect={onSelect} />);
  act(() => resize(360, 600));
  const fitted = camera();
  for (const x of [-200, 200]) expect(x * fitted.scale + fitted.x).toBeGreaterThanOrEqual(8);
  for (const x of [-200, 200]) expect(x * fitted.scale + fitted.x).toBeLessThanOrEqual(352);
  expect(LayoutWorker.instances).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Open a, 1 linked notes' })).toHaveAttribute(
    'cx',
    '-200',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
  const zoomed = camera();
  expect(zoomed.scale).toBeGreaterThan(fitted.scale);
  act(() => resize(500, 600));
  expect(camera().scale).toBe(zoomed.scale);
  fireEvent.click(screen.getByRole('button', { name: 'Fit', exact: true }));
  expect(camera().scale).not.toBe(zoomed.scale);
});

it('reports a layout failure and terminates its worker on unmount', () => {
  const { unmount } = render(<KnowledgeGraph snapshot={snapshot} selected="" onSelect={vi.fn()} />);
  const worker = LayoutWorker.instances[0];
  act(() => worker.onerror?.());
  expect(screen.getByRole('alert')).toHaveTextContent('use Files');
  unmount();
  expect(worker.terminate).toHaveBeenCalledOnce();
});
