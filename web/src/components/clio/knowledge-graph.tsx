import type { KnowledgeSnapshot } from '@clio/core/v3';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { knowledgeTopology, type KnowledgeGraphLayout } from '@/lib/knowledge-graph-layout';
import { knowledgeLabels, type GraphCamera, type GraphSize } from '@/lib/knowledge-graph-labels';
import { KnowledgeGraphGeometry } from './knowledge-graph-geometry';

function fittedCamera(graph: KnowledgeGraphLayout, size: GraphSize): GraphCamera {
  if (!graph.nodes.length) return { x: size.width / 2, y: size.height / 2, scale: 1 };
  const xs = graph.nodes.map((node) => node.x),
    ys = graph.nodes.map((node) => node.y);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  const scale = Math.max(
    0.04,
    Math.min(
      1.6,
      (size.width - 100) / (right - left + 120),
      (size.height - 80) / (bottom - top + 100),
    ),
  );
  return {
    x: size.width / 2 - ((left + right) / 2) * scale,
    y: size.height / 2 - ((top + bottom) / 2) * scale,
    scale,
  };
}

/** A network overview with stable geometry, readable labels and local emphasis. */
export function KnowledgeGraph({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: KnowledgeSnapshot;
  selected: string;
  onSelect: (path: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<GraphSize>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<GraphCamera>({ x: 0, y: 0, scale: 1 });
  const [isolated, setIsolated] = useState(true);
  const [hover, setHover] = useState('');
  const [layout, setLayout] = useState<{
    topology: KnowledgeGraphLayout;
    graph?: KnowledgeGraphLayout;
    error?: string;
  }>();
  const drag = useRef<{ x: number; y: number; origin: GraphCamera } | null>(null);
  const topology = useMemo(() => {
    const result = knowledgeTopology(snapshot);
    return isolated ? result : { ...result, nodes: result.nodes.filter((node) => node.degree > 0) };
  }, [snapshot, isolated]);
  const graph = layout?.topology === topology ? layout.graph : undefined;
  const error = layout?.topology === topology ? layout.error : undefined;
  useEffect(() => {
    const worker = new Worker(new URL('../../lib/knowledge-graph.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<{ graph?: KnowledgeGraphLayout; error?: string }>) => {
      setLayout({ topology, ...event.data });
      if (event.data.graph && host.current) {
        setCamera(
          fittedCamera(event.data.graph, {
            width: host.current.clientWidth,
            height: host.current.clientHeight,
          }),
        );
      }
    };
    worker.onerror = () =>
      setLayout({ topology, error: 'Unable to arrange the graph. Try Refresh or use Files.' });
    worker.postMessage(topology);
    return () => worker.terminate();
  }, [topology]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      setSize((previous) => {
        if (next.width === previous.width && next.height === previous.height) return previous;
        setCamera((current) => ({
          ...current,
          x: current.x + (next.width - previous.width) / 2,
          y: current.y + (next.height - previous.height) / 2,
        }));
        return next;
      });
    });
    observer.observe(host.current!);
    return () => observer.disconnect();
  }, []);
  const fit = useCallback(() => {
    if (graph) setCamera(fittedCamera(graph, size));
  }, [graph, size]);
  const active = hover || selected;
  useEffect(() => {
    const node = graph?.nodes.find((item) => item.id === active);
    if (!node || !size.width) return;
    // Wait for the reader's resize observation before framing a selected node.
    const frame = requestAnimationFrame(() =>
      setCamera((current) => {
        const x = node.x * current.scale + current.x,
          y = node.y * current.scale + current.y;
        return x >= 35 && x <= size.width - 35 && y >= 35 && y <= size.height - 35
          ? current
          : {
              ...current,
              x: size.width / 2 - node.x * current.scale,
              y: size.height / 2 - node.y * current.scale,
            };
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [active, graph, size]);
  const zoom = useCallback(
    (factor: number, x = size.width / 2, y = size.height / 2) =>
      setCamera((current) => {
        const scale = Math.min(5, Math.max(0.04, current.scale * factor));
        return {
          scale,
          x: x - ((x - current.x) * scale) / current.scale,
          y: y - ((y - current.y) * scale) / current.scale,
        };
      }),
    [size],
  );
  useEffect(() => {
    const element = host.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoom(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [zoom]);
  const labels = useMemo(
    () => (graph ? knowledgeLabels(graph, camera, size, active) : []),
    [graph, camera, size, active],
  );
  const select = useCallback((path: string) => onSelect(path), [onSelect]);
  const setHovered = useCallback((path: string) => setHover(path), []);
  return (
    <div className="flex h-full min-h-80 flex-col" role="region" aria-label="Note graph">
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-xs text-muted-foreground">
        <span>Larger dots have more links. Hover to trace; select to read.</span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5">
          <Checkbox checked={isolated} onCheckedChange={(value) => setIsolated(value === true)} />
          Isolated notes
        </label>
      </div>
      <div ref={host} className="relative min-h-80 flex-1 overflow-hidden bg-background">
        {!graph && !error && (
          <p
            role="status"
            className="absolute inset-0 grid place-items-center text-sm text-muted-foreground"
          >
            Arranging note connections…
          </p>
        )}
        {error && (
          <p role="alert" className="p-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {graph && !graph.nodes.length && (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            {isolated
              ? 'No notes match this view.'
              : 'No linked notes in this view. Enable isolated notes or change your search.'}
          </p>
        )}
        {graph && (
          <svg
            width="100%"
            height="100%"
            className="absolute inset-0 touch-none"
            aria-label={`${graph.nodes.length} notes, ${graph.edges.length} connections`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY, origin: camera };
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              setCamera({
                ...drag.current.origin,
                x: drag.current.origin.x + event.clientX - drag.current.x,
                y: drag.current.origin.y + event.clientY - drag.current.y,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
              <KnowledgeGraphGeometry
                graph={graph}
                active={active}
                selected={selected}
                scale={camera.scale}
                onSelect={select}
                onHover={setHovered}
              />
            </g>
            <g
              aria-hidden="true"
              pointerEvents="none"
              fill="var(--foreground)"
              fontSize={13}
              stroke="var(--background)"
              strokeWidth={4}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {labels.map((label) => (
                <text
                  key={label.id}
                  x={label.x}
                  y={label.y}
                  fontWeight={label.id === active ? 600 : 400}
                >
                  {label.text}
                </text>
              ))}
            </g>
          </svg>
        )}
        <div
          className="absolute bottom-3 left-3 flex gap-1 rounded-md border bg-background/95 p-1 shadow-sm"
          role="group"
          aria-label="Graph navigation"
        >
          <Button size="sm" variant="ghost" aria-label="Zoom in" onClick={() => zoom(1.3)}>
            +
          </Button>
          <Button size="sm" variant="ghost" aria-label="Zoom out" onClick={() => zoom(1 / 1.3)}>
            −
          </Button>
          <Button size="sm" variant="ghost" onClick={fit}>
            Fit
          </Button>
        </div>
      </div>
    </div>
  );
}
