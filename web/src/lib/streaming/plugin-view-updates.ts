import { decodeEventEnvelope, type TransportFrame } from '@clio/core/v3';
import type { QueryClient } from '@tanstack/react-query';
import { pluginViewEventsQueryKey } from '@/hooks/use-plugin-views';
import { FrameBatcher, type FrameClock } from './frame-batcher';

const SETTLED_TOOL_STATES = new Set(['succeeded', 'failed', 'denied', 'cancelled']);

/**
 * Whether a frame settles a tool call: the point where its result part, and
 * any plugin view event on it, is recorded.
 */
export function frameSettlesTool(frame: TransportFrame): boolean {
  if (frame.eventName !== 'tool.upserted') return false;
  try {
    const payload = decodeEventEnvelope(frame.data).payload as { state?: unknown } | null;
    return typeof payload?.state === 'string' && SETTLED_TOOL_STATES.has(payload.state);
  } catch {
    // Frame reduction owns malformed-envelope gap reporting, including this event.
    return false;
  }
}

/**
 * Re-reads a session's plugin view events when its live stream settles tool
 * calls, at most once per display frame however many settle together.
 */
export class PluginViewRefresher {
  private readonly batcher: FrameBatcher<true>;

  public constructor(
    queryClient: Pick<QueryClient, 'invalidateQueries'>,
    endpoint: string,
    sessionId: string,
    clock?: FrameClock,
  ) {
    const queryKey = pluginViewEventsQueryKey(endpoint, sessionId);
    this.batcher = new FrameBatcher<true>(() => {
      void queryClient.invalidateQueries({ queryKey });
    }, clock);
  }

  public push(frame: TransportFrame): void {
    if (frameSettlesTool(frame)) this.batcher.push(true);
  }

  public stop(options: { flush: boolean }): void {
    this.batcher.stop(options);
  }
}
