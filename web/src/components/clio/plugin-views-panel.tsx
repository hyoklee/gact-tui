import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePluginViews } from '@/hooks/use-plugin-views';
import type { PluginView, PluginViewSession } from '@/lib/plugin-view-model';
import { cn } from '@/lib/utils';
import { PluginViewSurface } from './plugin-view-surface';

/** Every plugin view, in name order. */
export function PluginViewList({ views }: { views: readonly PluginView[] }) {
  return (
    <div className="grid min-w-0 gap-4">
      {views.map((view) => (
        <PluginViewSurface key={view.view} view={view} />
      ))}
    </div>
  );
}

/**
 * The Views region a person watching a study sees above its tree: collapsible,
 * open by default, and absent until some session of the tree records a view.
 */
export function PluginViewsSection({
  sessionId,
  sessions,
}: {
  sessionId: string;
  /** The tree's sessions, when the caller already knows them. */
  sessions?: readonly PluginViewSession[];
}) {
  const { views } = usePluginViews(sessionId, { sessions });
  const [open, setOpen] = useState(true);
  if (!views.length) return null;
  return (
    <Collapsible
      className="min-w-0 rounded-lg border bg-card/40"
      data-slot="plugin-views"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
        <ChevronDownIcon
          aria-hidden="true"
          className={cn('size-4 shrink-0 motion-safe:transition-transform', !open && '-rotate-90')}
        />
        Views
        <span className="text-xs font-normal text-muted-foreground">
          {views.length} {views.length === 1 ? 'view' : 'views'}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <PluginViewList views={views} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The Views workbench tab: the views of a session's tree outside a study. */
export function PluginViewsTab({ sessionId }: { sessionId: string }) {
  const { views, pending } = usePluginViews(sessionId);
  if (!views.length)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {pending ? 'Reading the views…' : 'No views have been recorded in this conversation.'}
      </p>
    );
  return (
    <div className="h-full min-h-0 overflow-auto p-3">
      <PluginViewList views={views} />
    </div>
  );
}
