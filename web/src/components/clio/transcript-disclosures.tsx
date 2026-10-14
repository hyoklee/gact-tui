import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { TranscriptDisclosureContext } from './transcript-disclosure-context';

type TranscriptDisclosuresProps = { children: ReactNode; sessionId?: string };

/** Reuse session choices above responsive layouts and virtualized conversation rows. */
export function TranscriptDisclosures({ children, sessionId }: TranscriptDisclosuresProps) {
  const parent = useContext(TranscriptDisclosureContext);
  if (parent && parent.sessionId === sessionId) return children;
  return (
    <SessionDisclosures key={sessionId ?? ''} sessionId={sessionId}>
      {children}
    </SessionDisclosures>
  );
}

function SessionDisclosures({ children, sessionId }: TranscriptDisclosuresProps) {
  const [choices, setChoices] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const setOpen = useCallback((id: string, open: boolean) => {
    setChoices((current) => {
      if (current.get(id) === open) return current;
      const next = new Map(current);
      next.set(id, open);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ sessionId, choices, setOpen }), [sessionId, choices, setOpen]);
  return (
    <TranscriptDisclosureContext.Provider value={value}>
      {children}
    </TranscriptDisclosureContext.Provider>
  );
}
