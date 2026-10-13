import type { SubagentOpenTarget } from './subagent-card';

/** Keep the parent visible by default; Shift opens the child in the center. */
export function subagentOpenTarget(event: { shiftKey: boolean }): SubagentOpenTarget {
  return event.shiftKey ? 'conversation' : 'canvas';
}

export const SUBAGENT_OPEN_HINT = 'Open in a workspace tab. Shift-click to open in the center.';
