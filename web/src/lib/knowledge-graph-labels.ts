import type { KnowledgeGraphLayout } from './knowledge-graph-layout';

export interface GraphCamera {
  x: number;
  y: number;
  scale: number;
}
export interface GraphSize {
  width: number;
  height: number;
}

/** Prioritize the active neighborhood, then hubs; omit overlapping labels. */
export function knowledgeLabels(
  graph: KnowledgeGraphLayout,
  camera: GraphCamera,
  size: GraphSize,
  active: string,
) {
  const neighbors = new Set<string>([active]);
  for (const edge of graph.edges) {
    if (edge.source === active) neighbors.add(edge.target);
    if (edge.target === active) neighbors.add(edge.source);
  }
  const candidates = graph.nodes.filter(
    (node) => graph.nodes.length <= 40 || (active ? neighbors.has(node.id) : node.degree > 0),
  );
  candidates.sort(
    (a, b) =>
      Number(b.id === active) - Number(a.id === active) ||
      Number(neighbors.has(b.id)) - Number(neighbors.has(a.id)) ||
      b.degree - a.degree ||
      a.id.localeCompare(b.id),
  );
  const occupied: { x: number; y: number; width: number; height: number }[] = [];
  const labels: { id: string; text: string; x: number; y: number }[] = [];
  const maximum = active || graph.nodes.length <= 40 || camera.scale >= 1.5 ? 60 : 12;
  for (const node of candidates) {
    if (labels.length >= maximum) break;
    const text = node.title.length > 34 ? node.title.slice(0, 32) + '…' : node.title;
    const width = text.length * 7.2 + 6;
    const px = node.x * camera.scale + camera.x;
    const py = node.y * camera.scale + camera.y;
    const gap = node.radius * camera.scale + 9;
    for (const [x, y] of [
      [px + gap, py - 17],
      [px - gap - width, py - 17],
      [px + gap, py + 6],
      [px - gap - width, py + 6],
    ]) {
      const rect = { x, y, width, height: 20 };
      if (x < 8 || y < 8 || x + width > size.width - 8 || y + 20 > size.height - 8) continue;
      if (
        occupied.some(
          (other) =>
            x < other.x + other.width &&
            x + width > other.x &&
            y < other.y + other.height &&
            y + 20 > other.y,
        )
      )
        continue;
      occupied.push(rect);
      labels.push({ id: node.id, text, x: x + 3, y: y + 14 });
      break;
    }
  }
  return labels;
}
