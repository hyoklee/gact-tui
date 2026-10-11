import type { ExecutionProvenanceResult, ExecutionProvenanceSpan, Session } from '@clio/core/v3';
import { describe, expect, it } from 'vitest';
import { conversationGantt } from './conversation-gantt-model';

const at = (seconds: number) => new Date(seconds * 1000).toISOString();
const root = { id: 'root', workspace_id: 'workspace', title: 'Baseline', session_kind: 'conversation', created_at: at(0), updated_at: at(1000) } as Session;
const child = { ...root, id: 'child', title: 'Offset', parent_session_id: 'root', session_kind: 'branch', metadata: { fork_origin: { session_id: 'root', message_id: 'baseline', message_count: 2, created_at: at(100) } } } as Session;
const turn = (id: string, session_id: string, start_time: number, end_time: number | null) => ({ id, session_id, event_type: 'turn.started', start_time, end_time, status: 'completed' }) as ExecutionProvenanceSpan;
const provenance = (spans: ExecutionProvenanceSpan[]) => ({ spans }) as ExecutionProvenanceResult;

describe('conversation-family recorded Gantt', () => {
  it('draws actual response intervals and connects the saved branch point to the first child response', () => {
    const model = conversationGantt([root, child], 'child', provenance([turn('baseline', 'root', 10, 20), turn('offset', 'child', 105, 115), turn('unrelated', 'outside', 0, 1000)]), 200000);
    expect(model.events.filter((event) => event.data?.kind === 'turn')).toHaveLength(2);
    const first = model.events.find((event) => event.id === 'turn:offset')!;
    expect(first.parentActivity).toEqual({ eventId: 'fork:child', at: new Date(at(100)) });
    expect(first.end.getTime() - first.start.getTime()).toBe(10000);
    expect(model.extent).toEqual({ start: 10000, end: 115000 });
    expect(model.resources[0]?.children?.[0]?.id).toBe('child');
  });
  it('marks an empty branch without pretending it has executed', () => {
    const model = conversationGantt([root, child], 'root', provenance([]), 200000);
    expect(model.events.every((event) => event.start.getTime() === event.end.getTime())).toBe(true);
    expect(model.events.find((event) => event.id === 'branch:child')?.parentActivity?.eventId).toBe('fork:child');
  });
  it('does not synthesize missing historic fork points or use updated_at as active duration', () => {
    const legacy = { ...child, metadata: {} };
    const model = conversationGantt([root, legacy], 'root', provenance([turn('work', 'root', 10, 20)]), 200000);
    expect(model.events).toHaveLength(1);
    expect(model.extent).toEqual({ start: 10000, end: 20000 });
  });
  it('extends only explicitly running recorded responses to now', () => {
    const model = conversationGantt([root], 'root', provenance([turn('running', 'root', 10, null)]), 30000);
    expect(model.events[0]?.end.getTime()).toBe(30000);
  });
});
