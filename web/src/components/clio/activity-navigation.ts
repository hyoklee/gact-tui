import type { KeyboardEvent } from 'react';
import type { ObservabilityActivityItem } from './observability-activity';
import { subagentOpenTarget } from './subagent-navigation';

/** Follow the recorded child or transcript destination of an activity row. */
export function activateActivityItem(
  item: ObservabilityActivityItem,
  event: { shiftKey: boolean },
) {
  if (item.kind === 'process' && item.onOpen) {
    item.onOpen(subagentOpenTarget(event));
  } else if (item.transcriptMessageId) {
    const target = item.kind === 'tool' ? `/activity-${encodeURIComponent(item.id)}` : '';
    const hash = `#message-${encodeURIComponent(item.transcriptMessageId)}${target}`;
    if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else window.location.hash = hash;
  } else if (item.onActivate) item.onActivate();
  else item.onOpen?.(subagentOpenTarget(event));
}

/** Preserve Shift when a child row is activated without a pointer. */
export function activateActivityItemFromKeyboard(
  item: ObservabilityActivityItem,
  event: KeyboardEvent,
) {
  if (
    event.shiftKey &&
    (event.key === 'Enter' || event.key === ' ') &&
    item.onOpen &&
    (item.kind === 'process' || (!item.transcriptMessageId && !item.onActivate))
  ) {
    event.preventDefault();
    activateActivityItem(item, event);
  }
}
