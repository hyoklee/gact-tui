import type { ExecutionProvenanceResult, Session } from '@clio/core/v3';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Gantt } from '@/components/reui/gantt/gantt';
import { GanttNav, GanttTitle } from '@/components/reui/gantt/gantt-nav';
import { GanttView } from '@/components/reui/gantt/gantt-view';
import { conversationGantt, type ConversationGanttData } from './conversation-gantt-model';
import { executionZoom } from './observability-execution-model';

/** Conversation-family Gantt with real turn durations and connected fork milestones. */
export function ConversationGantt({
  sessions,
  sessionId,
  provenance,
  pending,
}: {
  sessions: readonly Session[];
  sessionId: string;
  provenance?: ExecutionProvenanceResult;
  pending?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ width: 900, rem: 16 });
  const [now, setNow] = useState(Date.now);
  const [selected, setSelected] = useState<ConversationGanttData>();
  const model = useMemo(
    () => conversationGantt(sessions, sessionId, provenance, now),
    [sessions, sessionId, provenance, now],
  );
  const running = provenance?.spans.some(
    (span) => span.event_type === 'turn.started' && span.end_time === null,
  );
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setGeometry({
        width: element.clientWidth || 900,
        rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const treeWidth = Math.min(260, Math.max(150, geometry.width * 0.25));
  const interval = model.extent.end - model.extent.start < 10 * 60000 ? 1 : 15;
  const initialZoom = executionZoom(
    model.extent,
    geometry.width - treeWidth,
    geometry.rem,
    interval,
  );
  const key = `${geometry.width}:${model.events.map((event) => event.id).join(':')}`;
  const [zoomState, setZoomState] = useState({ key, value: initialZoom });
  const zoom = zoomState.key === key ? zoomState.value : initialZoom;
  const center = new Date((model.extent.start + model.extent.end) / 2);
  return (
    <div
      ref={container}
      aria-label="Conversation family Gantt"
      role="region"
      className="min-w-0 overflow-hidden rounded-lg border [&_[data-slot=gantt-bar-label]]:hidden"
    >
      {model.events.length ? (
        <Gantt<ConversationGanttData>
          key={key}
          events={model.events}
          resources={model.resources}
          defaultDate={center}
          initialCenter={center}
          defaultScale="day"
          interval={interval}
          defaultInteractions={{ drag: false, resize: false, selectSlot: false }}
          baselineBars={false}
          dependencyLines
          summaryBars={false}
          rowCheckboxes={false}
          offDays={false}
          infiniteScroll={false}
          barLabel="inside"
          nowIndicator={Boolean(running)}
          scheduleMode="single"
          timelineLines="both"
          metrics={{ laneHeight: 1.25, minRowHeight: 3, rowPadding: 0.6, unitWidths: { day: 2.5 } }}
          treePanel={{
            width: treeWidth,
            minWidth: 140,
            maxWidth: 360,
            nameColumnWidth: treeWidth - 20,
          }}
          zoom={zoom}
          onZoomChange={(value) => setZoomState({ key, value })}
          zoomRange={{ min: 0.02, max: 256, step: Math.max(0.25, initialZoom / 8) }}
          wheelZoom
          style={{ height: Math.min(600, Math.max(260, 110 + model.family.sessions.length * 48)) }}
          onEventClick={(occurrence) => setSelected(occurrence.event.data)}
          onResourceClick={({ resource }) => {
            const session = sessions.find((session) => session.id === resource.id);
            if (session) setSelected({ session, kind: 'turn', status: session.state });
          }}
        >
          <GanttNav className="py-1.5">
            <GanttTitle>Conversation family</GanttTitle>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Fit conversation family"
              onClick={() => setZoomState({ key, value: initialZoom })}
            >
              <ScanIcon />
              Fit
            </Button>
          </GanttNav>
          <GanttView />
        </Gantt>
      ) : (
        <p className="p-5 text-sm text-muted-foreground">
          {pending
            ? 'Loading recorded family activity…'
            : 'No turn timings or saved branch points are available for this family.'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2 text-xs text-muted-foreground">
        {selected ? (
          <>
            <strong className="text-foreground">{selected.session.title}</strong>
            <span>
              {selected.kind === 'fork'
                ? 'Recorded branch creation'
                : 'Recorded conversation activity'}
            </span>
            <Link
              className="text-primary underline underline-offset-4"
              to={`/workspaces/${encodeURIComponent(selected.session.workspace_id)}/sessions/${encodeURIComponent(selected.session.id)}`}
            >
              Open conversation
            </Link>
          </>
        ) : (
          <span>
            Bars: recorded agent responses · diamonds: branch creation · select a row or event to
            open its conversation.
          </span>
        )}
        {provenance && (!provenance.complete || provenance.truncated) ? (
          <span role="status">Timing history is partial.</span>
        ) : null}
        {!provenance && !pending ? (
          <span role="status">
            Turn timings are unavailable; only saved branch points are shown.
          </span>
        ) : null}
      </div>
    </div>
  );
}
