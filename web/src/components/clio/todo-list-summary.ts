/** Count unfinished todos in the recorded list. */
export function todoCurrentSummary<T>(
  items: readonly T[],
  status: (item: T) => string | undefined,
): string {
  return `${items.filter((item) => status(item) !== 'completed').length}/${items.length} current`;
}
