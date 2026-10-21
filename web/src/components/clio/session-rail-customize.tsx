import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { AddIcon, RemoveIcon, ConfigureIcon } from '@/lib/icon-vocabulary';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SESSION_RAIL_SECTIONS, type SessionRailLayout } from './session-rail-layout';

/** A single compact row per section; no second inventory of descriptive cards. */
export function SessionRailCustomize({
  layout,
  onChange,
  onReset,
}: {
  layout: SessionRailLayout;
  onChange: (layout: SessionRailLayout) => void;
  onReset: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label="Customize rail"
        >
          <ConfigureIcon className="size-3.5" /> Customize
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2" aria-label="Customize session rail">
        <div className="px-2 pb-2">
          <h3 className="text-sm font-medium">Session rail</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved on this device. Empty sections appear when available.
          </p>
        </div>
        <ul className="clio-scrollbar max-h-80 overflow-y-auto" aria-label="Rail sections">
          {layout.order.map((id, index) => {
            const label = SESSION_RAIL_SECTIONS.find((section) => section.id === id)!.label;
            const included = !layout.hidden.includes(id);
            const move = (offset: -1 | 1) => {
              const order = [...layout.order];
              [order[index], order[index + offset]] = [order[index + offset]!, id];
              onChange({ ...layout, order });
            };
            return (
              <li
                key={id}
                className="flex h-9 items-center gap-0.5 border-b border-border/50 last:border-0"
              >
                <span
                  className={`min-w-0 flex-1 truncate px-2 text-xs ${included ? '' : 'text-muted-foreground'}`}
                >
                  {label}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-6"
                  aria-label={`Move ${label} up`}
                  disabled={index === 0}
                  onClick={() => move(-1)}
                >
                  <ArrowUpIcon className="size-3" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-6"
                  aria-label={`Move ${label} down`}
                  disabled={index === layout.order.length - 1}
                  onClick={() => move(1)}
                >
                  <ArrowDownIcon className="size-3" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-7"
                  aria-label={`${included ? 'Remove' : 'Add'} ${label}`}
                  aria-pressed={included}
                  onClick={() =>
                    onChange({
                      ...layout,
                      hidden: included
                        ? [...layout.hidden, id]
                        : layout.hidden.filter((hidden) => hidden !== id),
                    })
                  }
                >
                  {included ? (
                    <RemoveIcon className="size-3.5" />
                  ) : (
                    <AddIcon className="size-3.5" />
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
        <Button variant="ghost" size="sm" className="mt-1 h-8 w-full text-xs" onClick={onReset}>
          Reset layout
        </Button>
      </PopoverContent>
    </Popover>
  );
}
