import { useState } from 'react';
import type { NDPDataset } from '@clio/core/v3';
import { ChevronDownIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { sourceBytes } from './connected-source-labels';
import { ndpSearchText } from './use-ndp-catalog';

/** Keep dataset and resource names readable, revealing matching files while filtering. */
export function NDPDatasetRow({
  dataset,
  query,
  selected,
  disabled,
  onChange,
}: {
  dataset: NDPDataset;
  query: string;
  selected: string[];
  disabled: boolean;
  onChange: (resourceId: string, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<{ query: string; open: boolean }>();
  const tokens = ndpSearchText(query).split(/\s+/).filter(Boolean);
  const fileMatch =
    tokens.length > 0 &&
    dataset.resources.some((resource) => {
      const text = ndpSearchText(`${resource.name} ${resource.format}`);
      return tokens.every((token) => text.includes(token));
    });
  const open = expanded?.query === query ? expanded.open : fileMatch;
  return (
    <Collapsible
      open={open}
      onOpenChange={(value) => setExpanded({ query, open: value })}
      className="py-3"
    >
      <CollapsibleTrigger className="group flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0 space-y-1">
          <span className="block break-words font-medium">{dataset.title || dataset.name}</span>
          {dataset.description ? (
            <span className="line-clamp-2 block text-sm text-muted-foreground">
              {dataset.description}
            </span>
          ) : null}
          <span className="block text-xs text-muted-foreground">
            {dataset.endpoint_name} · {dataset.resources.length} resource
            {dataset.resources.length === 1 ? '' : 's'}
            {dataset.resources.some((item) => item.format)
              ? ` · ${[...new Set(dataset.resources.map((item) => item.format).filter(Boolean))].join(', ')}`
              : ''}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {selected.length > 0 ? (
            <span className="text-xs text-primary">{selected.length} selected</span>
          ) : null}
          {dataset.access ? (
            <Badge variant="outline">
              {dataset.access === 'viewer' ? 'Viewer' : 'Request access'}
            </Badge>
          ) : null}
          <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pt-3">
        {dataset.resources.map((resource) => (
          <label
            key={resource.id}
            className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
          >
            <Checkbox
              className="mt-0.5"
              checked={selected.includes(resource.id)}
              disabled={disabled}
              onCheckedChange={(checked) => onChange(resource.id, checked === true)}
            />
            <span className="min-w-0 flex-1 break-words">
              {resource.name}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {resource.format}
                {resource.size ? ` · ${sourceBytes(resource.size)}` : ''}
              </span>
            </span>
          </label>
        ))}
        {!dataset.resources.length ? (
          <p className="text-sm text-muted-foreground">No resources in this dataset.</p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
