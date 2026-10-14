import type { ExecutionProvenanceResult, Session } from '@clio/core/v3';
import type { GanttEvent, GanttResource } from '@/components/reui/gantt/gantt-types';
import { conversationFamily } from './conversation-relationships-model';
import { conversationForkOrigin } from './conversation-fork-origin';
import { isManagedChildSession } from '@/lib/session-state';

export interface ConversationGanttData {
  session: Session;
  kind: 'turn' | 'fork';
  status: string;
}

/** Recorded turns and durable branch events; never treat session lifetime as active work. */
export function conversationGantt(
  sessions: readonly Session[],
  sessionId: string,
  provenance: ExecutionProvenanceResult | undefined,
  now: number,
) {
  const family = conversationFamily(sessions, sessionId);
  const byId = new Map(family.sessions.map((session) => [session.id, session]));
  const resourcesById = new Map(
    family.sessions.map((session): [string, GanttResource] => [
      session.id,
      { id: session.id, title: session.title, children: [] },
    ]),
  );
  for (const edge of family.edges)
    resourcesById.get(edge.source)?.children?.push(resourcesById.get(edge.target)!);
  const events: GanttEvent<ConversationGanttData>[] = [];
  for (const span of provenance?.spans ?? []) {
    const session = byId.get(span.owner_session_id || span.session_id);
    if (!session || span.event_type !== 'turn.started' || span.start_time === null) continue;
    const start = span.start_time * 1000;
    const end = span.end_time === null ? now : Math.max(start, span.end_time * 1000);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    events.push({
      id: `turn:${span.id}`,
      resourceId: session.id,
      title: 'Agent response',
      start: new Date(start),
      end: new Date(end),
      readOnly: true,
      color:
        span.status === 'failed'
          ? 'var(--destructive)'
          : session.id === sessionId
            ? 'var(--primary)'
            : isManagedChildSession(session)
              ? 'var(--color-chart-3)'
              : 'var(--color-chart-2)',
      data: { session, kind: 'turn', status: span.status },
    });
  }
  for (const edge of family.edges.filter((edge) => edge.kind === 'delegation')) {
    const child = byId.get(edge.target)!;
    const raw = child.metadata?.['delegation_origin'];
    if (!raw || typeof raw !== 'object') continue;
    const task = raw as Record<string, unknown>;
    if (
      task['session_id'] !== edge.source ||
      typeof task['turn_id'] !== 'string' ||
      typeof task['created_at'] !== 'string'
    )
      continue;
    const created = Date.parse(task['created_at']);
    const parentSpan = provenance?.spans.find(
      (span) =>
        (span.owner_session_id || span.session_id) === edge.source &&
        span.event_type === 'turn.started' &&
        span.attributes?.['turn_id'] === task['turn_id'],
    );
    const parent = events.find((event) => event.id === `turn:${parentSpan?.id}`);
    const first = events
      .filter(
        (event) =>
          event.resourceId === child.id &&
          event.data?.kind === 'turn' &&
          event.start.getTime() >= created,
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    if (parent && first && created >= parent.start.getTime() && created <= parent.end.getTime())
      first.parentActivity = { eventId: parent.id, at: new Date(created), kind: 'delegation' };
  }
  for (const edge of family.edges.filter((edge) => edge.kind === 'branch')) {
    const child = byId.get(edge.target)!;
    const parent = byId.get(edge.source)!;
    const origin = conversationForkOrigin(child);
    const created = origin ? Date.parse(origin.created_at) : Number.NaN;
    if (!Number.isFinite(created)) continue;
    const pointId = `fork:${child.id}`;
    events.push({
      id: pointId,
      resourceId: parent.id,
      title: 'Branch created',
      start: new Date(created),
      end: new Date(created),
      color: 'var(--primary)',
      readOnly: true,
      data: { session: child, kind: 'fork', status: 'completed' },
    });
    const first = events
      .filter(
        (event) =>
          event.resourceId === child.id &&
          event.data?.kind === 'turn' &&
          event.start.getTime() >= created,
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    if (first) first.parentActivity = { eventId: pointId, at: new Date(created), kind: 'fork' };
    else
      events.push({
        id: `branch:${child.id}`,
        resourceId: child.id,
        title: 'Branch start',
        start: new Date(created),
        end: new Date(created),
        color: 'var(--primary)',
        readOnly: true,
        parentActivity: { eventId: pointId, at: new Date(created), kind: 'fork' },
        data: { session: child, kind: 'fork', status: 'completed' },
      });
  }
  const starts = events.map((event) => event.start.getTime());
  const ends = events.map((event) => event.end.getTime());
  return {
    events,
    family,
    resources: family.sessions[0] ? [resourcesById.get(family.sessions[0].id)!] : [],
    extent: {
      start: starts.length ? Math.min(...starts) : now,
      end: ends.length ? Math.max(...ends) : now,
    },
  };
}
