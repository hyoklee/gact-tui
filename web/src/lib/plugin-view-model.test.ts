import { pluginViewEventsFromMessages, type Session, type TransportFrame } from '@clio/core/v3';
import { describe, expect, it, vi } from 'vitest';
import { descendantViewSessions, studyViewSessions } from '@/hooks/use-plugin-views';
import { PluginViewRefresher, frameSettlesTool } from '@/lib/streaming/plugin-view-updates';
import {
  READINGS_COMPONENT,
  reading,
  recordedMessage,
  viewPart,
} from '@/test-fixtures/plugin-view/plugin-view-fixtures';
import { mergePluginViews, pluginViewTitle, shortSessionId } from './plugin-view-model';

/** The read lists messages newest first, as the service does. */
const rootMessages = [
  recordedMessage('m2', 'sess_root', '2026-10-27T10:05:00Z', [
    { id: 'text', type: 'text', text: 'Two more readings.' },
    viewPart(
      'c3',
      { key: 'r2', group: 'sess_root', rows: [reading(2, 'x', 1.9)] },
      '2026-10-27T10:05:01Z',
    ),
    // A later reading replaces the earlier rows of the same item.
    viewPart(
      'c4',
      { key: 'r1', group: 'sess_root', rows: [reading(1, 'x', 1.5)] },
      '2026-10-27T10:05:02Z',
    ),
  ]),
  recordedMessage('m1', 'sess_root', '2026-10-27T10:00:00Z', [
    { id: 'call', type: 'tool_call', call_id: 'c1' },
    viewPart(
      'c1',
      {
        key: 'r1',
        group: 'sess_root',
        rows: [reading(1, 'x', 1.4)],
        component: READINGS_COMPONENT,
      },
      '2026-10-27T10:00:01Z',
    ),
    { id: 'bad', type: 'tool_result', metadata: { ui_event: { view: 'missing-catalog' } } },
  ]),
];

const childMessages = [
  recordedMessage('c1', 'sess_child_8f3b4b', '2026-10-27T10:03:00Z', [
    // The same item key in another session is another item.
    viewPart(
      'c9',
      { key: 'r1', group: 'sess_child_8f3b4b', rows: [reading(1, 'x', 2.2)] },
      '2026-10-27T10:03:01Z',
    ),
  ]),
];

describe('plugin view events', () => {
  it('reads tool results oldest first and skips malformed events', () => {
    const events = pluginViewEventsFromMessages('sess_root', rootMessages);
    expect(events.map((event) => [event.key, event.at, event.order])).toEqual([
      ['r1', '2026-10-27T10:00:01Z', 0],
      ['r2', '2026-10-27T10:05:01Z', 1],
      ['r1', '2026-10-27T10:05:02Z', 2],
    ]);
    expect(events[0]!.component?.component).toBe('Readings');
    expect(events[1]!.component).toBeUndefined();
  });

  it('merges the latest rows per item, the latest component and branch titles', () => {
    const events = [
      ...pluginViewEventsFromMessages('sess_root', rootMessages),
      ...pluginViewEventsFromMessages('sess_child_8f3b4b', childMessages),
    ];
    const [view] = mergePluginViews(events, new Map([['sess_root', 'Pendulum study']]));
    expect(view!.view).toBe('hidden-law-bench/readings');
    expect(view!.component?.component).toBe('Readings');
    expect(view!.componentSession).toBe('sess_root');
    expect(view!.items).toBe(3);
    expect(view!.groups).toEqual(['sess_root', 'sess_child_8f3b4b']);
    expect(view!.updatedAt).toBe('2026-10-27T10:05:02Z');
    expect(view!.rows.map((row) => [row.reading, row.period_s, row.branch])).toEqual([
      [1, 2.2, '8f3b4b'],
      [2, 1.9, 'Pendulum study'],
      [1, 1.5, 'Pendulum study'],
    ]);
    expect(pluginViewTitle(view!)).toBe('Bench readings');
    expect(pluginViewTitle({ view: 'some-plugin/live_wall' })).toBe('Live wall');
  });

  it('keeps a view with rows but no recorded component', () => {
    const events = pluginViewEventsFromMessages('sess_child_8f3b4b', childMessages);
    const [view] = mergePluginViews(events);
    expect(view!.component).toBeUndefined();
    expect(view!.rows).toHaveLength(1);
    expect(shortSessionId('sess_child_8f3b4b')).toBe('8f3b4b');
  });
});

describe('plugin view sessions', () => {
  const session = (id: string, parent: string, state: Session['state'], title = id) =>
    ({ id, parent_session_id: parent, state, title }) as Session;

  it('lists a session and its descendants, never its parent or siblings', () => {
    const sessions = {
      top: session('top', '', 'completed'),
      root: session('root', 'top', 'completed', 'Root'),
      a: session('a', 'root', 'running', 'Child A'),
      b: session('b', 'a', 'completed'),
      other: session('other', 'top', 'running'),
    };
    expect(descendantViewSessions(sessions, 'root')).toEqual([
      { id: 'root', title: 'Root', running: false },
      { id: 'a', title: 'Child A', running: true },
      { id: 'b', title: 'b', running: false },
    ]);
  });

  it('lists a study by its branches', () => {
    expect(
      studyViewSessions([
        { session_id: 's1', title: '', workflow_step: 'h1', task_status: 'running' },
        { session_id: 's2', title: 'Second', workflow_step: '', task_status: 'completed' },
      ] as never),
    ).toEqual([
      { id: 's1', title: 'h1', running: true },
      { id: 's2', title: 'Second', running: false },
    ]);
  });
});

describe('plugin view live refresh', () => {
  const frame = (eventName: string, state: string): TransportFrame =>
    ({
      cursor: '1',
      eventName,
      data: {
        protocol_version: '0.3',
        type: eventName,
        scope: { connection_id: 'local', session_id: 'sess_root' },
        occurred_at: '2026-10-27T10:00:00Z',
        payload: { id: 'c1', session_id: 'sess_root', name: 'measure', state },
      },
    }) as unknown as TransportFrame;

  it('re-reads once per frame when tool calls settle', () => {
    const callbacks: FrameRequestCallback[] = [];
    const clock = {
      request: (callback: FrameRequestCallback) => callbacks.push(callback),
      cancel: vi.fn(),
    };
    const invalidateQueries = vi.fn();
    const refresher = new PluginViewRefresher(
      { invalidateQueries },
      'http://e',
      'sess_root',
      clock,
    );
    refresher.push(frame('tool.upserted', 'running'));
    expect(callbacks).toHaveLength(0);
    refresher.push(frame('tool.upserted', 'succeeded'));
    refresher.push(frame('tool.upserted', 'failed'));
    expect(callbacks).toHaveLength(1);
    callbacks[0]!(0);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(frameSettlesTool(frame('message.completed', 'succeeded'))).toBe(false);
  });
});
