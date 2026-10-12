import type { KnowledgeSnapshot } from '@clio/core/v3';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';

export interface KnowledgeGraphNode {
  id: string;
  title: string;
  degree: number;
  radius: number;
  x: number;
  y: number;
}
export interface KnowledgeGraphEdge {
  source: string;
  target: string;
}
export interface KnowledgeGraphLayout {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

/** Each authored pair is one visual connection; directions remain in the reader. */
export function knowledgeTopology(
  snapshot: Pick<KnowledgeSnapshot, 'notes' | 'links'>,
): KnowledgeGraphLayout {
  const notes = new Map(snapshot.notes.map((note) => [note.path, note]));
  const unique = new Map<string, KnowledgeGraphEdge>();
  for (const link of snapshot.links) {
    if (
      link.status !== 'resolved' ||
      link.source === link.target ||
      !notes.has(link.source) ||
      !notes.has(link.target)
    )
      continue;
    const [source, target] = [link.source, link.target].sort();
    unique.set(JSON.stringify([source, target]), { source, target });
  }
  const degree = new Map<string, number>();
  for (const edge of unique.values())
    for (const id of [edge.source, edge.target]) degree.set(id, (degree.get(id) ?? 0) + 1);
  return {
    nodes: [...notes.values()].map((note) => ({
      id: note.path,
      title: note.title,
      degree: degree.get(note.path) ?? 0,
      radius: Math.min(12, 3 + Math.sqrt(degree.get(note.path) ?? 0) * 1.4),
      x: 0,
      y: 0,
    })),
    edges: [...unique.values()],
  };
}

/** Compute static network geometry in a worker, without imposing a hierarchy. */
export function layoutKnowledgeGraph(topology: KnowledgeGraphLayout): KnowledgeGraphLayout {
  const nodes = topology.nodes.map((node) => ({ ...node }));
  const connected = nodes.filter((node) => node.degree > 0);
  // Leave initial positions unset so D3 uses its deterministic phyllotaxis seed.
  const particles = connected.map(({ x: _x, y: _y, ...node }) => ({ ...node, x: NaN, y: NaN }));
  const small = nodes.length <= 40;
  const links = topology.edges.map((edge) => ({ ...edge }));
  const simulation = forceSimulation(particles)
    .force(
      'links',
      forceLink<KnowledgeGraphNode, (typeof links)[number]>(links)
        .id((node) => node.id)
        .distance(small ? 150 : 55)
        .strength(0.3),
    )
    .force(
      'charge',
      forceManyBody()
        .strength(small ? -650 : -90)
        .distanceMax(800),
    )
    .force(
      'collisions',
      forceCollide<KnowledgeGraphNode>()
        .radius((node) => node.radius + (small ? 55 : 9))
        .iterations(2),
    )
    .force('x', forceX(0).strength(0.025))
    .force('y', forceY(0).strength(0.025))
    .stop();
  simulation.tick(260);
  const positions = new Map(particles.map((node) => [node.id, node]));
  for (const node of connected)
    Object.assign(node, { x: positions.get(node.id)!.x, y: positions.get(node.id)!.y });
  // Unlinked notes have no implied relationship. Keep them visible around the
  // network instead of pulling them into unrelated clusters with fake edges.
  const isolated = nodes.filter((node) => !node.degree);
  let radius = connected.length
    ? Math.max(...connected.map((node) => Math.hypot(node.x, node.y))) + 65
    : 0;
  let offset = 0;
  while (offset < isolated.length) {
    radius += small ? 100 : 24;
    const count = Math.min(
      isolated.length - offset,
      Math.max(1, Math.floor((2 * Math.PI * radius) / (small ? 150 : 18))),
    );
    for (let index = 0; index < count; index++) {
      const angle = (2 * Math.PI * (index + 0.5)) / count;
      Object.assign(isolated[offset + index], {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }
    offset += count;
  }
  return { nodes, edges: topology.edges };
}
