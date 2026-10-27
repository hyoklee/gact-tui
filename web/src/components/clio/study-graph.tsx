import type { ScienceStudy } from '@clio/core/v3';
import { graphlib, layout } from '@dagrejs/dagre';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ENTRY_TYPE_LABELS } from './science-log-model';
import {
  studyGraph,
  studyGraphNeighborhood,
  type StudyGraphModel,
  type StudyGraphNode,
} from './study-graph-model';
import { ScienceStateChip } from './study-tree';

interface EntryNodeData extends Record<string, unknown> {
  entry: StudyGraphNode;
  selected: boolean;
  onSelect: (id: string) => void;
}
type EntryNode = Node<EntryNodeData, 'science-entry'>;
const nodeTypes = { 'science-entry': EntryCard };
const width = 288;
const height = 142;

export interface StudyGraphProps {
  study: ScienceStudy;
  selectedEntry?: string;
  onSelectEntry: (id: string) => void;
}

/** Explore the study's actual links, then select a node to read its original record. */
export function StudyGraph({ study, selectedEntry, onSelectEntry }: StudyGraphProps) {
  const [local, setLocal] = useState(false);
  const model = useMemo(() => studyGraph(study), [study]);
  const focused = local && selectedEntry ? selectedEntry : undefined;
  const graph = useMemo(
    () => layoutStudyGraph(focused ? studyGraphNeighborhood(model, focused) : model),
    [model, focused],
  );
  const nodes = useMemo(
    () =>
      graph.nodes.map((node) => ({
        ...node,
        data: { ...node.data, selected: node.id === selectedEntry, onSelect: onSelectEntry },
      })),
    [graph.nodes, selectedEntry, onSelectEntry],
  );
  if (!model.nodes.length)
    return <p className="text-sm text-muted-foreground">No entries to graph yet.</p>;
  return (
    <section aria-label="Study relationship graph" className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {graph.nodes.length} entries, {graph.edges.length} recorded links
        </span>
        <Button aria-pressed={!local} onClick={() => setLocal(false)} size="xs" variant="outline">
          Entire study
        </Button>
        <Button
          aria-pressed={local}
          disabled={!selectedEntry}
          onClick={() => setLocal(true)}
          size="xs"
          variant="outline"
        >
          Selected and linked
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Arrows follow recorded relationships. Select an entry to read its record below.
      </p>
      <div className="h-[clamp(26rem,62vh,46rem)] min-w-0 overflow-hidden rounded-md border bg-background">
        <ReactFlow<EntryNode, Edge>
          key={focused ? `entry:${focused}` : 'study'}
          nodes={nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15, minZoom: 0.12, maxZoom: 1 }}
          minZoom={0.12}
          maxZoom={1.8}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--border)" gap={24} size={1} />
          <Controls
            aria-label="Study graph controls"
            showInteractive={false}
            className="!border-border !shadow-none [&_button]:!border-border [&_button]:!bg-background [&_button]:!fill-foreground [&_button:hover]:!bg-muted"
          />
        </ReactFlow>
      </div>
    </section>
  );
}

function EntryCard({ data }: NodeProps<EntryNode>) {
  const { entry } = data;
  const kind = ENTRY_TYPE_LABELS[entry.kind as keyof typeof ENTRY_TYPE_LABELS] ?? 'Entry';
  return (
    <div className="relative" style={{ width, height }}>
      <Handle className="!size-0 !border-0" position={Position.Bottom} type="target" />
      <button
        aria-label={`${kind}: ${entry.title}, ${entry.state.label}`}
        aria-pressed={data.selected}
        className={cn(
          'nodrag nopan flex h-full w-full flex-col gap-2 rounded-md border bg-card p-3 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
          data.selected && 'border-primary ring-2 ring-primary/30',
          entry.missing && 'border-dashed',
        )}
        disabled={entry.missing}
        onClick={() => data.onSelect(entry.id)}
        title={entry.title}
        type="button"
      >
        <span className="flex w-full items-center justify-between gap-2 text-xs font-medium">
          <span>{kind}</span>
          <ScienceStateChip state={entry.state} />
        </span>
        <span className="line-clamp-3 text-xs leading-5">{entry.title}</span>
        <span className="mt-auto w-full truncate text-[11px] text-muted-foreground">
          {entry.branch || entry.id}
        </span>
      </button>
      <Handle className="!size-0 !border-0" position={Position.Top} type="source" />
    </div>
  );
}

function layoutStudyGraph(model: StudyGraphModel): { nodes: EntryNode[]; edges: Edge[] } {
  // Citation arrows point back to their sources. Bottom-to-top layout puts the
  // question above the later evidence without reversing any recorded relation.
  const dag = new graphlib.Graph({ multigraph: true }).setDefaultEdgeLabel(() => ({}));
  dag.setGraph({ rankdir: 'BT', nodesep: 44, ranksep: 80, marginx: 24, marginy: 24 });
  for (const node of model.nodes) dag.setNode(node.id, { width, height });
  for (const edge of model.edges) dag.setEdge(edge.source, edge.target, {}, edge.id);
  layout(dag);
  return {
    nodes: model.nodes.map((entry) => {
      const position = dag.node(entry.id);
      return {
        id: entry.id,
        type: 'science-entry',
        position: { x: position.x - width / 2, y: position.y - height / 2 },
        style: { width, height },
        data: { entry, selected: false, onSelect: () => undefined },
      };
    }),
    edges: model.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.relation,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)', width: 18, height: 18 },
      style: { stroke: 'var(--primary)', strokeWidth: 1.5 },
      labelStyle: { fill: 'var(--foreground)', fontSize: 11 },
      labelBgStyle: { fill: 'var(--background)', fillOpacity: 1 },
      labelBgPadding: [5, 3],
    })),
  };
}
