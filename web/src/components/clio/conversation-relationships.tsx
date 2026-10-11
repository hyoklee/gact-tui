import type { Artifact, Session } from '@clio/core/v3';
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
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  BotIcon,
  GitBranchIcon,
  MessageSquareIcon,
  ArrowUpRightIcon,
  FileBoxIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { isManagedChildSession } from '@/lib/session-state';
import { cn } from '@/lib/utils';
import { ClioStatus } from './status';
import { conversationFamily } from './conversation-relationships-model';
import { conversationForkOrigin } from './conversation-fork-origin';

interface ConversationNodeData extends Record<string, unknown> {
  session: Session;
  current: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}
type ConversationNode = Node<ConversationNodeData, 'conversation'>;
const nodeTypes = { conversation: ConversationCard };
const width = 232;
const height = 92;

/** The same workspace's conversation ancestry, separate from file revision lineage. */
export function ConversationRelationships({
  sessions,
  sessionId,
  artifacts,
  onOpenArtifact,
  selectedId: requestedId,
  onSelect,
}: {
  sessions: readonly Session[];
  sessionId: string;
  artifacts: readonly Artifact[];
  onOpenArtifact?: (artifact: Artifact) => void;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const family = useMemo(() => conversationFamily(sessions, sessionId), [sessions, sessionId]);
  const container = useRef<HTMLDivElement>(null);
  const selectedId = requestedId ?? sessionId;
  const selected =
    family.sessions.find((session) => session.id === selectedId) ?? family.sessions[0];
  const origin = conversationForkOrigin(selected);
  const graph = useMemo(() => {
    const dag = new graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    dag.setGraph({ rankdir: 'LR', nodesep: 38, ranksep: 100, marginx: 20, marginy: 24 });
    for (const session of family.sessions) dag.setNode(session.id, { width, height });
    for (const edge of family.edges) dag.setEdge(edge.source, edge.target);
    layout(dag);
    const nodes: ConversationNode[] = family.sessions.map((session) => {
      const position = dag.node(session.id);
      return {
        id: session.id,
        type: 'conversation',
        position: { x: position.x - width / 2, y: position.y - height / 2 },
        style: { width, height },
        ariaLabel: `${session.title}, ${relationshipLabel(session)}`,
        data: {
          session,
          current: session.id === sessionId,
          selected: session.id === selectedId,
          onSelect,
        },
      };
    });
    const edges: Edge[] = family.edges.map((edge) => ({
      id: `${edge.source}:${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      label: edge.kind === 'branch' ? 'User branch' : 'Delegated',
      pathOptions: { borderRadius: 10 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--primary)', width: 18, height: 18 },
      style: {
        stroke: 'var(--primary)',
        strokeWidth: 1.5,
        strokeOpacity: 0.75,
        strokeDasharray: edge.kind === 'delegation' ? '5 4' : undefined,
      },
      labelStyle: { fill: 'var(--muted-foreground)', fontSize: 11 },
      labelBgStyle: { fill: 'var(--background)', fillOpacity: 1 },
      labelBgPadding: [5, 3],
    }));
    return { nodes, edges };
  }, [family, selectedId, sessionId, onSelect]);
  if (!selected)
    return (
      <p className="p-5 text-sm text-muted-foreground">
        Conversation relationships are unavailable.
      </p>
    );
  const outputs = artifacts.filter(
    (artifact) => artifact.session_id === selected.id && artifact.session_relation !== 'used',
  );
  return (
    <section aria-label="Conversation relationships" className="min-w-0">
      <p className="mb-3 text-xs text-muted-foreground">
        {family.sessions.length} conversations · solid arrows: user branches · dashed arrows:
        delegated agents
      </p>
      {family.incomplete ? (
        <p role="status" className="mb-3 text-xs text-muted-foreground">
          Showing the available family. Some ancestors or descendants are outside this view.
        </p>
      ) : null}
      <div className="grid min-w-0 gap-4 @min-[48rem]:grid-cols-[minmax(0,1fr)_15rem]">
        <div
          ref={container}
          aria-label="Conversation relationship graph"
          className="min-w-0 overflow-hidden"
          style={{
            height: Math.min(
              620,
              Math.max(
                320,
                Math.max(...graph.nodes.map((node) => node.position.y + height)) -
                  Math.min(...graph.nodes.map((node) => node.position.y)) +
                  64,
              ),
            ),
          }}
          role="region"
        >
          <ReactFlow<ConversationNode, Edge>
            key={family.sessions.map((session) => session.id).join(':')}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            nodesConnectable={false}
            nodesDraggable={false}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1, minZoom: 0.05 }}
            minZoom={0.05}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
            zoomOnDoubleClick={false}
          >
            <FitOnResize container={container} />
            <Background color="var(--border)" gap={24} size={1} />
            <Controls
              showInteractive={false}
              className="!border-border !shadow-none [&_button]:!border-border [&_button]:!bg-background [&_button]:!fill-foreground"
            />
          </ReactFlow>
        </div>
        <aside
          aria-label="Selected conversation"
          className="min-w-0 border-t pt-3 @min-[48rem]:border-l @min-[48rem]:border-t-0 @min-[48rem]:pl-4 @min-[48rem]:pt-1"
        >
          <p className="text-[11px] text-muted-foreground">{relationshipLabel(selected)}</p>
          <h3 className="mt-1 break-words text-sm font-semibold">{selected.title}</h3>
          <div className="my-3">
            <ClioStatus compact value={selected.state} />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {isManagedChildSession(selected)
              ? 'Work owned by its parent agent. User branches remain separate conversations.'
              : selected.parent_session_id
                ? 'Independent continuation with copied history. Workspace files remain shared.'
                : 'Starting conversation for this family.'}
          </p>
          {selected.model_id ? (
            <p className="mt-2 break-words text-xs text-muted-foreground">
              {selected.provider_id} · {selected.model_id}
            </p>
          ) : null}
          <Link
            to={`/workspaces/${encodeURIComponent(selected.workspace_id)}/sessions/${encodeURIComponent(selected.id)}`}
            className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {selected.id === sessionId ? 'Return to conversation' : 'Open conversation'}
            <ArrowUpRightIcon className="size-3.5" />
          </Link>
          {origin ? (
            <Link
              to={`/workspaces/${encodeURIComponent(selected.workspace_id)}/sessions/${encodeURIComponent(origin.session_id)}${origin.message_id ? `#message-${encodeURIComponent(origin.message_id)}` : ''}`}
              className="mt-3 block text-xs text-muted-foreground underline underline-offset-4"
            >
              Open fork source
            </Link>
          ) : null}
          <div className="mt-5 border-t pt-3">
            <h4 className="text-xs font-medium">Outputs</h4>
            {outputs.length ? (
              outputs.map((artifact) => (
                <Button
                  key={artifact.id}
                  className="mt-1 h-auto w-full justify-start whitespace-normal px-0 text-left text-xs"
                  variant="link"
                  onClick={() => onOpenArtifact?.(artifact)}
                  disabled={!onOpenArtifact}
                >
                  <FileBoxIcon className="size-3.5 shrink-0" />
                  {artifact.name}
                </Button>
              ))
            ) : (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {selected.id === sessionId
                  ? 'No output files are loaded for this conversation.'
                  : 'Open this conversation to inspect its outputs.'}
              </p>
            )}
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              Open a file, then select Lineage to trace its inputs and revisions.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Refit after the canvas changes host or width, including the mobile sheet. */
function FitOnResize({ container }: { container: RefObject<HTMLDivElement | null> }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void fitView({ padding: 0.15, maxZoom: 1, minZoom: 0.05 });
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [container, fitView]);
  return null;
}

function relationshipLabel(session: Session): string {
  return isManagedChildSession(session)
    ? 'Delegated agent · parent owned'
    : session.parent_session_id
      ? 'User branch'
      : 'Conversation';
}

function ConversationCard({ data }: NodeProps<ConversationNode>) {
  const Icon = isManagedChildSession(data.session)
    ? BotIcon
    : data.session.parent_session_id
      ? GitBranchIcon
      : MessageSquareIcon;
  return (
    <div
      className={cn(
        'h-full rounded-lg border bg-background px-3 py-2.5 shadow-sm',
        data.selected && 'border-primary ring-1 ring-primary/20',
        isManagedChildSession(data.session) && 'border-dashed',
      )}
    >
      <Handle className="!size-1.5 !border-0 !bg-primary" type="target" position={Position.Left} />
      <button
        type="button"
        aria-label={`Select ${data.session.title}`}
        aria-pressed={data.selected}
        onClick={() => data.onSelect(data.session.id)}
        className="nodrag nopan flex h-full w-full gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="line-clamp-2 text-xs font-semibold leading-4">{data.session.title}</span>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            {relationshipLabel(data.session)}
            {data.current ? ' · current' : ''}
          </span>
        </span>
      </button>
      <Handle className="!size-1.5 !border-0 !bg-primary" type="source" position={Position.Right} />
    </div>
  );
}
