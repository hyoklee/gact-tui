import { useState } from 'react';
import type { NDPDataset } from '@clio/core/v3';
import { ChevronDownIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { sourceBytes } from './connected-source-labels';

/** Show readable dataset details and resource choices without an extra expand step. */
export function NDPDatasetRow({
  dataset,
  selected,
  disabled,
  onChange,
}: {
  dataset: NDPDataset;
  selected: string[];
  disabled: boolean;
  onChange: (resourceId: string, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="py-3">
      <CollapsibleTrigger className="group flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0 space-y-1">
          <span className="block break-words font-medium">{dataset.title || dataset.name}</span>
          {dataset.description ? (
            <span className="block break-words text-sm text-muted-foreground">
              {dataset.description}
            </span>
          ) : null}
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
              <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                {resource.format ? <span>{resource.format}</span> : null}
                {resource.size ? <span>{sourceBytes(resource.size)}</span> : null}
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
