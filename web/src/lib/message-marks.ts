/** Read navigation marks saved with a conversation, including imported sessions. */
export function messageMarkIds(metadata: Record<string, unknown> | undefined): ReadonlySet<string> {
  const value = metadata?.message_marks;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return new Set();
  return new Set(
    Object.entries(value)
      .filter(([, marked]) => marked === true)
      .map(([id]) => id),
  );
}
