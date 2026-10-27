import { z } from 'zod';
import type { ClioTransport } from './transport.js';

/**
 * A plugin view's events (`metadata.ui_event` on a `tool_result` part).
 *
 * A plugin's own tool results feed its live view; the agent never writes one.
 * Each event names its view (`<plugin>/<name>`), the catalog that renders it,
 * the item it updates (`key`), the session that made the call (`group`) and
 * that item's current rows. Only a view's first event carries its `component`
 * (the catalog component, with the fixed spec it renders).
 *
 * These events are recorded only on the original part ledger, which the
 * `0.2` message read returns: the `0.3` transcript projection keeps a tool's
 * output, not its part metadata. The read is asked for that ledger by header.
 */

/** Request headers that select the recorded part ledger for one message read. */
export const PLUGIN_VIEW_PARTS_HEADERS: Readonly<Record<string, string>> = {
  'X-GACT-Version': '0.2',
};

const rowSchema = z.record(z.string(), z.unknown());

export const pluginViewComponentSchema = z
  .object({
    id: z.string().default('view'),
    component: z.string().min(1),
    spec: z.record(z.string(), z.unknown()).optional(),
    title: z.string().optional(),
  })
  .passthrough();

export type PluginViewComponent = z.infer<typeof pluginViewComponentSchema>;

export const pluginViewEventSchema = z.object({
  view: z.string().min(1),
  catalog: z.string().min(1),
  key: z.string(),
  group: z.string().default(''),
  rows: z.array(rowSchema).default([]),
  component: pluginViewComponentSchema.nullish().transform((value) => value ?? undefined),
});

/** One recorded view event, with where and when it was recorded. */
export type PluginViewEvent = z.infer<typeof pluginViewEventSchema> & {
  /** The session whose transcript recorded the event. */
  session_id: string;
  /** When the tool call completed (ISO time), or empty when not recorded. */
  at: string;
  /** Position in that session's transcript, oldest first. */
  order: number;
};

interface RecordedPart {
  type?: unknown;
  metadata?: unknown;
}

interface RecordedMessage {
  created_at?: unknown;
  parts?: unknown;
}

/**
 * The view events of one session's recorded messages, oldest first. A
 * malformed event is skipped: it never stops the rest of the view.
 */
export function pluginViewEventsFromMessages(
  sessionId: string,
  messages: readonly unknown[],
): PluginViewEvent[] {
  const rows = messages
    .filter((value): value is RecordedMessage => typeof value === 'object' && value !== null)
    .map((message, index) => ({ message, index }));
  // The read lists messages newest first; events are replayed oldest first.
  rows.sort(
    (left, right) =>
      String(left.message.created_at ?? '').localeCompare(String(right.message.created_at ?? '')) ||
      right.index - left.index,
  );
  const events: PluginViewEvent[] = [];
  for (const { message } of rows) {
    const parts = Array.isArray(message.parts) ? (message.parts as RecordedPart[]) : [];
    for (const part of parts) {
      if (part?.type !== 'tool_result' || typeof part.metadata !== 'object' || !part.metadata)
        continue;
      const metadata = part.metadata as Record<string, unknown>;
      const parsed = pluginViewEventSchema.safeParse(metadata['ui_event']);
      if (!parsed.success) continue;
      events.push({
        ...parsed.data,
        session_id: sessionId,
        at: typeof metadata['completed_at'] === 'string' ? metadata['completed_at'] : '',
        order: events.length,
      });
    }
  }
  return events;
}

/** Read one session's plugin view events from its recorded part ledger. */
export function readPluginViewEvents(
  transport: ClioTransport,
  sessionId: string,
  signal?: AbortSignal,
): Promise<PluginViewEvent[]> {
  return transport.request({
    method: 'GET',
    path: `/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
    headers: { ...PLUGIN_VIEW_PARTS_HEADERS },
    decode: (value) => {
      const messages = Array.isArray(value)
        ? value
        : ((value as { messages?: unknown } | null)?.messages ?? []);
      return pluginViewEventsFromMessages(sessionId, Array.isArray(messages) ? messages : []);
    },
    signal,
  });
}
