import { ChevronDownIcon, GripVerticalIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sortable, SortableItem, SortableItemHandle } from '@/components/reui/sortable';
import { useEvidenceDisclosure } from '@/hooks/use-evidence-disclosures';
import { useSessionRailLayout } from '@/hooks/use-session-rail-layout';
import { SessionRailCustomize } from './session-rail-customize';
import {
  reorderSessionRail,
  SESSION_RAIL_SECTIONS,
  type SessionRailItem,
  type SessionRailSectionId,
} from './session-rail-layout';

/** Configurable session inventory, backed by the existing evidence and work records. */
export function SessionRail({
  items,
  actions,
  title = 'Session',
  sections,
}: {
  items: SessionRailItem[];
  actions?: ReactNode;
  title?: string;
  sections?: readonly SessionRailSectionId[];
}) {
  const { layout, save, reset } = useSessionRailLayout();
  const visible = layout.order.filter(
    (id) => !layout.hidden.includes(id) && items.some((item) => item.id === id),
  );
  const move = (id: SessionRailSectionId, offset: -1 | 1) => {
    const index = visible.indexOf(id);
    if (index < 0 || index + offset < 0 || index + offset >= visible.length) return;
    const order = [...visible];
    [order[index], order[index + offset]] = [order[index + offset]!, id];
    save(reorderSessionRail(layout, order));
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-slot="session-rail">
      <div className="flex h-9 shrink-0 items-center gap-1 px-1">
        <span className="mr-auto pl-1 text-xs font-medium">{title}</span>
        <SessionRailCustomize
          layout={layout}
          onChange={save}
          onReset={reset}
          title={title}
          sections={sections}
        />
        {actions}
      </div>
      <div
        data-slot="session-rail-scroll"
        className="clio-scrollbar min-h-0 flex-1 overflow-y-auto px-1 pb-2"
      >
        <Sortable
          value={visible}
          getItemValue={sectionId}
          strategy="vertical"
          onValueChange={(order) => save(reorderSessionRail(layout, order))}
          className="grid divide-y divide-border/60"
        >
          {visible.map((id) => (
            <RailCard
              key={id}
              item={items.find((item) => item.id === id)!}
              onMove={(offset) => move(id, offset)}
            />
          ))}
        </Sortable>
        {!visible.length ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No sections to show. Add sections with Customize.
          </p>
        ) : null}
      </div>
    </div>
  );
}

const sectionId = (id: SessionRailSectionId) => id;

function RailCard({ item, onMove }: { item: SessionRailItem; onMove: (offset: -1 | 1) => void }) {
  const label = SESSION_RAIL_SECTIONS.find((section) => section.id === item.id)!.label;
  const [open, setOpen] = useEvidenceDisclosure(
    `session-rail:${item.id}`,
    item.defaultOpen ?? ['context', 'goal', 'connected', 'questions', 'todos'].includes(item.id),
  );
  return (
    <SortableItem
      value={item.id}
      role="region"
      tabIndex={-1}
      aria-label={`${label} section`}
      className="min-w-0"
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="group/rail-heading flex h-8 items-center pr-1">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 min-w-0 flex-1 justify-start gap-1.5 rounded-sm px-2 text-xs font-medium"
              aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
            >
              <span className="truncate">{label}</span>
              <ChevronDownIcon
                className={`size-3 shrink-0 text-muted-foreground ${open ? '' : '-rotate-90'}`}
              />
              {item.count === undefined ? null : (
                <span className="ml-auto text-xs font-normal tabular-nums text-muted-foreground">
                  {item.summary ?? item.count.toLocaleString()}
                </span>
              )}
            </Button>
          </CollapsibleTrigger>
          <SortableItemHandle asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 shrink-0 touch-none text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover/rail-heading:opacity-100"
              aria-label={`Drag ${label}`}
              title={`Drag ${label} to reorder. Alt+Up or Alt+Down to move with the keyboard.`}
              onKeyDown={(event) => {
                if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                  event.preventDefault();
                  event.stopPropagation();
                  onMove(event.key === 'ArrowUp' ? -1 : 1);
                }
              }}
            >
              <GripVerticalIcon className="size-3.5" />
            </Button>
          </SortableItemHandle>
        </div>
        <CollapsibleContent className="min-w-0 px-2 pb-2 text-xs">
          {item.content}
        </CollapsibleContent>
      </Collapsible>
    </SortableItem>
  );
}
