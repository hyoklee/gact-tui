import { usePluginViews } from '@/hooks/use-plugin-views';
import type { PluginView } from '@/lib/plugin-view-model';
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
