import type { KnowledgeSnapshot } from '@clio/core/v3';
import { graphlib, layout } from '@dagrejs/dagre';
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';

/** Show authored relationships from the same bounded source snapshot as the list. */
export function KnowledgeGraph({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: KnowledgeSnapshot;
  selected: string;
  onSelect: (path: string) => void;
}) {
  const graph = useMemo(() => {
    const dag = new graphlib.Graph()
      .setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 60 })
      .setDefaultEdgeLabel(() => ({}));
    for (const note of snapshot.notes) dag.setNode(note.path, { width: 180, height: 48 });
    const edges: Edge[] = snapshot.links
      .filter((link) => link.status === 'resolved')
      .map((link, index) => ({
        id: `${index}:${link.source}:${link.target}`,
        source: link.source,
        target: link.target,
        label: link.kind === 'embed' ? 'embed' : undefined,
        style: { stroke: 'var(--muted-foreground)' },
      }));
    for (const edge of edges) dag.setEdge(edge.source, edge.target);
    layout(dag);
    const nodes: Node[] = snapshot.notes.map((note) => {
      const position = dag.node(note.path);
      return {
        id: note.path,
        data: { label: note.title },
        position: { x: position.x - 90, y: position.y - 24 },
        selected: selected === note.path,
        ariaLabel: `Open ${note.path}`,
        style: {
          width: 180,
          height: 48,
          color: 'var(--foreground)',
          background: 'var(--background)',
          borderColor: selected === note.path ? 'var(--primary)' : 'var(--border)',
          borderWidth: selected === note.path ? 2 : 1,
        },
      };
    });
    return { nodes, edges };
  }, [snapshot, selected]);
  return (
    <div className="h-full min-h-80" role="region" aria-label="Vault knowledge graph">
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        onNodeClick={(_, node) => onSelect(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ maxZoom: 1, minZoom: 0.1 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
