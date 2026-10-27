import { useMemo, useState } from 'react';
import { useA2uiSessionRegistry } from '@/lib/a2ui/processor-store';
import { pluginViewSurface, pluginViewTitle, type PluginView } from '@/lib/plugin-view-model';
import type { PluginViewShadow } from '@/lib/plugin-view-shadow';
import { ClioA2UISurface } from './a2ui-surface';

/** One plugin view, drawn by its catalog component and updated in place. */
export function PluginViewSurface({ view }: { view: PluginView }) {
  // The catalogs of the session that recorded the component resolve it.
  useA2uiSessionRegistry([view.componentSession]);
  // Each new set of rows is the surface's next revision; the first is 2.
  const [tracked, setTracked] = useState({ rows: view.rows, revision: 2 });
  if (tracked.rows !== view.rows) setTracked({ rows: view.rows, revision: tracked.revision + 1 });
  const revision = tracked.rows === view.rows ? tracked.revision : tracked.revision + 1;
  const surface = useMemo(() => pluginViewSurface(view, revision), [view, revision]);
  const title = pluginViewTitle(view);
  const groups = view.groups.length;
  return (
    <section aria-label={title} className="min-w-0 space-y-1" data-slot="plugin-view">
      {/* The component draws its own title; without one, the view's name heads it. */}
      {surface ? null : <h4 className="px-1 text-sm font-medium">{title}</h4>}
      <p className="px-1 text-xs text-muted-foreground">
        {view.items} {view.items === 1 ? 'item' : 'items'} from {groups}{' '}
        {groups === 1 ? 'session' : 'sessions'}
        {view.updatedAt ? ` · updated ${new Date(view.updatedAt).toLocaleTimeString()}` : ''}
      </p>
      {view.shadow ? <PluginViewLaw shadow={view.shadow} rows={view.rows.length} /> : null}
      {surface ? (
        <div className="overflow-x-auto">
          <ClioA2UISurface readOnly surface={surface} />
        </div>
      ) : (
        <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          This view has rows but its layout has not been recorded yet.
        </p>
      )}
    </section>
  );
}

/** Which hypothesis the view's shadow is, in words. */
function PluginViewLaw({ shadow, rows }: { shadow: PluginViewShadow; rows: number }) {
  const { law } = shadow;
  // A hypothesis with no title or claim is labelled by its formula, shown in full below.
  const named = !law.text.startsWith(law.label.replace(/…$/u, ''));
  return (
    <p className="px-1 text-xs text-muted-foreground" data-slot="plugin-view-law">
      Shadow: the current law, hypothesis{' '}
      <span className="font-mono text-foreground">{law.id}</span>
      {named ? ` “${law.label}”` : ''}, drawn for {shadow.rows} of {rows}{' '}
      {rows === 1 ? 'row' : 'rows'}:{' '}
      <code className="font-mono break-words text-foreground">{law.text}</code>
    </p>
  );
}
