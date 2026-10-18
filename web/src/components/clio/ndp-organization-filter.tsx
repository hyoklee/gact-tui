import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useRepository } from '@/hooks/use-repository';
import { ndpSearchText } from './use-ndp-catalog';
import { useConnectionSettings } from '@/providers/connection-provider';
import { connectionScope } from '@/lib/connection-scope';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export type NDPOrganizationChoice = { id: string; endpoint_id: string };

/** Search actual catalog publisher identities without treating them as access grants. */
export function NDPOrganizationFilter({
  value,
  onChange,
}: {
  value: NDPOrganizationChoice | null;
  onChange: (choice: NDPOrganizationChoice | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const organizations = useQuery({
    queryKey: ['ndp-organizations', connectionScope(settings)],
    queryFn: ({ signal }) => repository.ndpOrganizations(signal),
    enabled: open,
    staleTime: 300_000,
    retry: false,
  });
  const select = (choice: NDPOrganizationChoice | null) => {
    onChange(choice);
    setOpen(false);
  };
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-label="Organization filter"
          aria-expanded={open}
          className="max-w-full"
        >
          <span className="truncate">{value?.id || 'All organizations'}</span>
          <ChevronsUpDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0">
        <Command
          className="h-auto min-h-0"
          filter={(text, query) =>
            ndpSearchText(query)
              .split(/\s+/)
              .every((token) => ndpSearchText(text).includes(token))
              ? 1
              : 0
          }
        >
          <CommandInput placeholder="Find an organization…" />
          {organizations.isFetching && !organizations.data ? (
            <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
              Loading organizations…
            </p>
          ) : null}
          {organizations.isError ? (
            <div role="alert" className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>Organizations unavailable.</span>
              <Button variant="ghost" size="sm" onClick={() => void organizations.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}
          <CommandList className="min-h-0 max-h-[min(18rem,40dvh)] touch-pan-y overscroll-contain">
            <CommandEmpty>No matching organizations.</CommandEmpty>
            <CommandItem onSelect={() => select(null)}>
              All organizations{!value ? <CheckIcon className="ml-auto" /> : null}
            </CommandItem>
            {organizations.data?.organizations.map((item) => (
              <CommandItem
                key={`${item.endpoint_id}/${item.id}`}
                value={`${item.id} ${item.endpoint_name}`}
                onSelect={() => select(item)}
                className="items-start"
              >
                <span className="min-w-0 break-words">
                  {item.id}
                  <span className="block text-xs text-muted-foreground">{item.endpoint_name}</span>
                </span>
                {value?.id === item.id && value.endpoint_id === item.endpoint_id ? (
                  <CheckIcon className="ml-auto shrink-0" />
                ) : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
