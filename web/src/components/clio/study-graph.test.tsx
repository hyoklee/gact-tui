import { type ScienceStudy } from '@clio/core/v3';
import { studyGraphFixture as study } from '../../../tests/fixtures/science-log-graph';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScienceLogView } from './science-log-tab';
import { studyGraph, studyGraphNeighborhood } from './study-graph-model';

vi.mock('@/hooks/use-repository', () => ({ useRepository: () => ({}) }));
vi.mock('@xyflow/react', () => ({
  Position: { Top: 'top', Bottom: 'bottom' },
  MarkerType: { ArrowClosed: 'closed' },
  Handle: () => null,
  Background: () => null,
  Controls: () => null,
  ReactFlow: ({
    nodes,
    nodeTypes,
    children,
  }: {
    nodes: { id: string; data: Record<string, unknown> }[];
    nodeTypes: Record<string, (props: { data: Record<string, unknown> }) => ReactNode>;
    children: ReactNode;
  }) => (
    <div>
      {nodes.map((node) => (
        <div key={node.id}>{nodeTypes['science-entry']!({ data: node.data })}</div>
      ))}
      {children}
    </div>
  ),
}));

afterEach(cleanup);

const entry = (
  id: string,
  branch: string,
  type: string,
  fields: Record<string, unknown>,
  links: { to: string; relation: string }[] = [],
  status = '',
) => ({
  id,
  branch,
  session: branch,
  type,
  fields,
  links,
  status,
  created_at: `2026-10-27T10:00:00Z`,
  invocation: `call-${id}`,
});

describe('recorded study graph', () => {
  it('keeps citation direction, cross-branch links, hypothesis states and conflict links', () => {
    const graph = studyGraph(study);
    expect(graph.nodes).toHaveLength(7);
    expect(graph.edges).toHaveLength(7);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({ source: 'c', target: 'e', relation: 'cites' }),
    );
    expect(graph.edges.filter((edge) => edge.source === 'x').map((edge) => edge.target)).toEqual([
      'h',
      'h2',
    ]);
    expect(graph.nodes.find((node) => node.id === 'h')).toMatchObject({
      branch: 'Original trial',
      state: { label: 'supported' },
    });
    expect(graph.nodes.find((node) => node.id === 'h2')).toMatchObject({
      branch: 'Alternative trial',
      state: { label: 'open' },
    });
    expect(graph.edges).not.toContainEqual(expect.objectContaining({ source: 'h', target: 'h2' }));
  });

  it('keeps unresolved targets visible instead of dropping their references', () => {
    const missing = {
      ...study,
      entries: [
        entry('a', 'root', 'evidence', {}, [{ relation: 'supports', to: 'missing' }]),
        entry('b', 'root', 'evidence', {}, [{ relation: 'cites', to: 'missing' }]),
      ],
    } as ScienceStudy;
    const graph = studyGraph(missing);
    expect(graph.nodes.filter((node) => node.missing)).toEqual([
      expect.objectContaining({
        id: 'missing',
        missing: true,
        state: { label: 'unavailable', tone: 'neutral' },
      }),
    ]);
    expect(graph.edges).toHaveLength(2);
  });

  it('focuses both incoming and outgoing links without adding transitive relations', () => {
    const graph = studyGraphNeighborhood(studyGraph(study), 'x');
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(['c', 'h', 'h2', 'x']);
    expect(graph.edges).toHaveLength(3);
    expect(graph.nodes.some((node) => node.id === 'q')).toBe(false);
  });

  it('preserves cycles and relation labels rather than forcing a scientific DAG', () => {
    const cyclic = {
      ...study,
      entries: [
        entry('a', 'root', 'evidence', {}, [{ relation: 'related_to', to: 'b' }]),
        entry('b', 'root', 'evidence', {}, [{ relation: 'related_to', to: 'a' }]),
      ],
    } as ScienceStudy;
    expect(studyGraph(cyclic).edges).toMatchObject([
      { source: 'a', target: 'b', relation: 'related to' },
      { source: 'b', target: 'a', relation: 'related to' },
    ]);
    expect(studyGraph({ ...study, entries: [] })).toEqual({ nodes: [], edges: [] });
  });
});

describe('science log graph navigation', () => {
  it('opens a graph node in its branch log and keeps that selection when returning to the tree', async () => {
    const user = userEvent.setup();
    render(<ScienceLogView study={study} sessionId="root" />);
    expect(screen.getByRole('tree', { name: 'Study tree' })).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'Graph' }));
    const graph = screen.getByRole('region', { name: 'Study relationship graph' });
    await user.click(
      within(graph).getByRole('button', { name: /Hypothesis: Square-root temperature law/ }),
    );
    expect(screen.getByRole('region', { name: 'Log of Alternative trial' })).toBeVisible();
    expect(document.getElementById('science-entry-h2')).toHaveAttribute('data-focused', 'true');
    await user.click(within(graph).getByRole('button', { name: 'Selected and linked' }));
    expect(within(graph).getByText('3 entries, 2 recorded links')).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'Tree' }));
    expect(screen.getByRole('region', { name: 'Log of Alternative trial' })).toBeVisible();
  });

  it('renders new recorded links on a study update and never enables an unavailable entry', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ScienceLogView study={study} sessionId="root" />);
    await user.click(screen.getByRole('radio', { name: 'Graph' }));
    const extra = entry('later', 'root', 'evidence', { interpretation: 'A new check' }, [
      { relation: 'cites', to: 'unavailable' },
    ]);
    rerender(
      <ScienceLogView
        study={{ ...study, entries: [...study.entries, extra] as ScienceStudy['entries'] }}
        sessionId="root"
      />,
    );
    expect(
      screen.getByRole('button', { name: /Entry: Unavailable entry unavailable/ }),
    ).toBeDisabled();
    expect(screen.getByText('9 entries, 8 recorded links')).toBeVisible();
  });
});
