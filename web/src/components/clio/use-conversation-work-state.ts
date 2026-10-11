import { useState } from 'react';

interface WorkState {
  view: 'gantt' | 'relationships';
  selectedId?: string;
  details: boolean;
}
const initial: WorkState = { view: 'gantt', details: false };

function read(sessionId: string): WorkState {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`clio.conversation-work:${sessionId}`) ?? 'null',
    );
    if (value?.view !== 'gantt' && value?.view !== 'relationships') return initial;
    return {
      view: value.view,
      details: value.details === true,
      selectedId: typeof value.selectedId === 'string' ? value.selectedId : undefined,
    };
  } catch {
    // Browser storage can be unavailable; navigation still works in memory.
    return initial;
  }
}

/** Retain the selected view and conversation when responsive canvas hosts remount. */
export function useConversationWorkState(sessionId: string) {
  const [saved, setSaved] = useState(() => ({ sessionId, value: read(sessionId) }));
  const state = saved.sessionId === sessionId ? saved.value : read(sessionId);
  const update = (patch: Partial<WorkState>) => {
    const value = { ...state, ...patch };
    setSaved({ sessionId, value });
    try {
      sessionStorage.setItem(`clio.conversation-work:${sessionId}`, JSON.stringify(value));
    } catch {
      // Preserve interaction even when this browser disallows persistence.
    }
  };
  return [state, update] as const;
}
