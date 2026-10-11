import { describe, expect, it } from 'vitest';
import { knowledgeTopology, layoutKnowledgeGraph } from './knowledge-graph-layout';
import { knowledgeLabels } from './knowledge-graph-labels';

const notes = ['a', 'b', 'c', 'unlinked'].map((path) => ({
  path,
  title: path,
  kind: 'note' as const,
  revision: '1',
  aliases: [],
  tags: [],
  headings: [],
  blocks: [],
  excerpt: '',
}));
const link = (source: string, target: string) => ({
  source,
  target,
  kind: 'link' as const,
  status: 'resolved' as const,
  selector: '',
  candidates: [],
});

describe('knowledge topology', () => {
  it('keeps one connection per authored pair and excludes absent targets and self loops', () => {
    const graph = knowledgeTopology({
      notes,
      links: [link('a', 'b'), link('b', 'a'), link('a', 'b'), link('a', 'a'), link('c', 'missing')],
    });
    expect(graph.edges).toEqual([{ source: 'a', target: 'b' }]);
    expect(graph.nodes.map((node) => node.degree)).toEqual([1, 1, 0, 0]);
  });
  it('lays out cycles without hierarchy, overlap or mutation, and separates unlinked notes', () => {
    const topology = knowledgeTopology({
      notes,
      links: [link('a', 'b'), link('b', 'c'), link('c', 'a')],
    });
    const result = layoutKnowledgeGraph(topology);
    expect(layoutKnowledgeGraph(topology)).toEqual(result);
    expect(topology.nodes.every((node) => node.x === 0 && node.y === 0)).toBe(true);
    for (const node of result.nodes)
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
    for (const a of result.nodes)
      for (const b of result.nodes)
        if (a.id !== b.id)
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius);
    const isolated = result.nodes.find((node) => node.id === 'unlinked')!;
    expect(Math.hypot(isolated.x, isolated.y)).toBeGreaterThan(
      Math.max(
        ...result.nodes.filter((node) => node.degree).map((node) => Math.hypot(node.x, node.y)),
      ),
    );
  });
  it('prioritizes the active title while keeping labels separated and inside the viewport', () => {
    const graph = layoutKnowledgeGraph(knowledgeTopology({ notes, links: [link('a', 'b')] }));
    const labels = knowledgeLabels(
      graph,
      { x: 400, y: 350, scale: 1 },
      { width: 800, height: 700 },
      'a',
    );
    expect(labels[0].id).toBe('a');
    for (const label of labels)
      expect(
        label.x >= 8 && label.y >= 8 && label.x + label.text.length * 7.2 < 800 && label.y < 700,
      ).toBe(true);
    for (const a of labels)
      for (const b of labels)
        if (a.id !== b.id)
          expect(
            a.x + a.text.length * 7.2 < b.x ||
              b.x + b.text.length * 7.2 < a.x ||
              Math.abs(a.y - b.y) >= 20,
          ).toBe(true);
  });
  it('names hubs in a zoomed-out large overview and limits active labels to its neighborhood', () => {
    const graph = {
      nodes: Array.from({ length: 50 }, (_, i) => ({
        id: `n${i}`,
        title: `Note ${i}`,
        degree: i ? 1 : 49,
        radius: 4,
        x: 40 + (i % 5) * 160,
        y: 40 + Math.floor(i / 5) * 50,
      })),
      edges: Array.from({ length: 49 }, (_, i) => ({ source: 'n0', target: `n${i + 1}` })),
    };
    const camera = { x: 10, y: 10, scale: 0.5 },
      size = { width: 900, height: 600 };
    const overview = knowledgeLabels(graph, camera, size, '');
    expect(overview.length).toBeGreaterThan(0);
    expect(overview.length).toBeLessThanOrEqual(12);
    expect(overview[0].id).toBe('n0');
    const active = knowledgeLabels(graph, camera, size, 'n25');
    expect(active[0].id).toBe('n25');
    expect(active.every((label) => label.id === 'n0' || label.id === 'n25')).toBe(true);
  });
});
