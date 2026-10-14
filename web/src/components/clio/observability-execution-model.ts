import type { AsyncProcess } from '@clio/core/v3';
import type { GanttEvent, GanttResource } from '@/components/reui/gantt/gantt-types';
import type { ClioStatusValue } from './status';

export interface ProcessSpan {
  id: string;
  label: string;
  laneLabel?: string;
  branch: string;
  owner: string;
  kind: ProcessLane['kind'];
  start: number;
  end: number | null;
  state: 'done' | 'running' | 'failed';
  status: ClioStatusValue;
  timing: 'exact' | 'observed';
  subagentId?: string;
  parentTurnId?: string;
  depth: number;
}

export interface ProcessLane {
  id: string;
  label: string;
  color: string;
  kind: 'main' | AsyncProcess['kind'] | 'tool';
  owner: string;
  depth: number;
  spans: ProcessSpan[];
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface ExecutionGanttData {
  span: ProcessSpan;
}

interface ExecutionGanttModel {
  events: GanttEvent<ExecutionGanttData>[];
  resources: GanttResource[];
}

/** Build named owner rows and duration events without inferring dependencies. */
export function executionGantt(
  lanes: readonly ProcessLane[],
  now: number,
  ownerNames: ReadonlyMap<string, string>,
): ExecutionGanttModel {
  const laneResourceIds = new Map(lanes.map((lane) => [lane.id, `lane:${lane.id}`]));
  const byOwner = groupLanesByOwner(lanes);
  const resources = [...byOwner.entries()].map(([owner, ownerLanes]) => {
    const work = ownerLanes.filter((lane) => lane.kind !== 'tool');
    const tools = ownerLanes.filter((lane) => lane.kind === 'tool');
    const children = tools.map((lane) => ({
      id: laneResourceIds.get(lane.id)!,
      title: lane.label,
      color: lane.color,
    }));
    const ownerLabel =
      owner === 'main'
        ? 'Main agent'
        : (work.find((lane) => lane.kind === 'agent' || lane.kind === 'mcp-task')?.label ??
          ownerNames.get(owner) ??
          'Background work');
    return { id: `owner:${owner}`, title: ownerLabel, children };
  });
  const events = lanes.flatMap((lane) =>
    lane.spans.map(
      (span): GanttEvent<ExecutionGanttData> => ({
        id: `event:${span.id}`,
        title: span.label,
        start: new Date(span.start),
        end: new Date(span.end ?? now),
        color: span.state === 'failed' ? 'var(--destructive)' : lane.color,
        data: { span },
        readOnly: true,
        parentActivity:
          span.parentTurnId &&
          lanes.some((parent) =>
            parent.spans.some((candidate) => candidate.id === span.parentTurnId),
          )
            ? { eventId: `event:${span.parentTurnId}`, at: new Date(span.start) }
            : undefined,
        resourceId: span.kind === 'tool' ? laneResourceIds.get(lane.id) : `owner:${lane.owner}`,
      }),
    ),
  );
  return { events, resources };
}

/** Count only rows visible beneath the current collapsed groups. */
export function resourceRowCount(
  resources: readonly GanttResource[],
  collapsed: ReadonlySet<string>,
): number {
  return resources.reduce(
    (count, resource) =>
      count +
      1 +
      (collapsed.has(resource.id) ? 0 : resourceRowCount(resource.children ?? [], collapsed)),
    0,
  );
}

function groupLanesByOwner(lanes: readonly ProcessLane[]): Map<string, ProcessLane[]> {
  const grouped = new Map<string, ProcessLane[]>();
  for (const lane of lanes) {
    const bucket = grouped.get(lane.owner);
    if (bucket) bucket.push(lane);
    else grouped.set(lane.owner, [lane]);
  }
  return grouped;
}

/** Fit the recorded execution interval into the measured axis width. */
export function executionZoom(
  range: TimeRange,
  width: number,
  rem: number,
  interval: number,
): number {
  const durationMinutes = Math.max(0.25, (range.end - range.start) / 60_000);
  // One axis unit is 2.5rem and represents `interval` minutes. Reserve room on
  // both sides of the observed window instead of fitting a whole calendar day.
  return Math.min(
    256,
    Math.max(0.02, (Math.max(120, width - 80) * interval) / (durationMinutes * 2.5 * rem)),
  );
}
