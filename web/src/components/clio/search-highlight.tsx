import { Fragment } from 'react';
import { searchMatchRanges } from '@/lib/search-matches';

/** Blue matches remain readable in both selected and unselected search results. */
export function SearchHighlight({
  text,
  query,
  ranges: suppliedRanges,
  partial = false,
}: {
  text: string;
  query: string;
  ranges?: ReadonlyArray<[number, number]>;
  partial?: boolean;
}) {
  const ranges = suppliedRanges ?? searchMatchRanges(text, query, partial);
  return (
    <>
      {ranges.map(([start, end], index) => {
        const before = text.slice(ranges[index - 1]?.[1] ?? 0, start);
        return (
          <Fragment key={start}>
            {before}
            <mark className="rounded-sm bg-blue-200 px-0.5 text-blue-950 dark:bg-blue-800 dark:text-blue-50">
              {text.slice(start, end)}
            </mark>
          </Fragment>
        );
      })}
      {text.slice(ranges.at(-1)?.[1] ?? 0)}
    </>
  );
}
