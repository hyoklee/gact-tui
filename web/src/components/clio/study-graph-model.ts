import type { ScienceStudy } from '@clio/core/v3';
import {
  branchTitle,
  entryState,
  entrySummary,
  outgoing,
  type ScienceState,
} from './science-log-model';

export interface StudyGraphNode {
  id: string;
  kind: string;
  title: string;
  branch: string;
  state: ScienceState;
  missing: boolean;
}

export interface StudyGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export interface StudyGraphModel {
  nodes: StudyGraphNode[];
  edges: StudyGraphEdge[];
}

/** Recorded entry relationships, including references whose targets are unavailable. */
export function studyGraph(study: ScienceStudy): StudyGraphModel {
  const titles = new Map(study.branches.map((branch) => [branch.session_id, branchTitle(branch)]));
  const entries = new Map(study.entries.map((entry) => [entry.id, entry]));
  const nodes: StudyGraphNode[] = [...entries.values()].map((entry) => ({
    id: entry.id,
    kind: entry.type,
    title: entrySummary(entry) || entry.id,
    branch: titles.get(entry.branch) || entry.branch,
    state: entryState(entry),
    missing: false,
  }));
  const missing = new Set<string>();
  const edges: StudyGraphEdge[] = [];
  for (const entry of entries.values()) {
    for (const link of outgoing(entry)) {
      if (!link.to) continue;
      edges.push({
        id: JSON.stringify([entry.id, link.to, link.relation]),
        source: entry.id,
        target: link.to,
        relation: link.relation.replaceAll('_', ' '),
      });
      if (!entries.has(link.to)) missing.add(link.to);
    }
  }
  for (const id of missing) {
    nodes.push({
      id,
      kind: 'unknown',
      title: `Unavailable entry ${id}`,
      branch: '',
      state: { label: 'unavailable', tone: 'neutral' },
      missing: true,
    });
  }
  return { nodes, edges };
}

/** An entry and every directly linked entry, in either direction. No inferred links. */
export function studyGraphNeighborhood(
  graph: StudyGraphModel,
  selectedId: string,
): StudyGraphModel {
  const ids = new Set([selectedId]);
  for (const edge of graph.edges) {
    if (edge.source === selectedId) ids.add(edge.target);
    if (edge.target === selectedId) ids.add(edge.source);
  }
  return {
    nodes: graph.nodes.filter((node) => ids.has(node.id)),
    edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
  };
}
