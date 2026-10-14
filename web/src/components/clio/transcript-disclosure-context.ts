import { createContext, useContext, useState } from 'react';

export const TranscriptDisclosureContext = createContext<{
  sessionId?: string;
  choices: ReadonlyMap<string, boolean>;
  setOpen: (id: string, open: boolean) => void;
} | null>(null);

/** Reader choices override changing defaults and survive conversation row suspension. */
export function useTranscriptDisclosure(
  id?: string,
  defaultOpen = false,
): [boolean, (open: boolean) => void] {
  const context = useContext(TranscriptDisclosureContext);
  const [local, setLocal] = useState<boolean>();
  return context && id
    ? [context.choices.get(id) ?? defaultOpen, (open) => context.setOpen(id, open)]
    : [local ?? defaultOpen, setLocal];
}
