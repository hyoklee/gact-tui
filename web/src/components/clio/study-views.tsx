import { a2uiSurfaceSchema, type ScienceStudy, type ScienceView } from '@clio/core/v3';
import { useMemo } from 'react';
import { useA2uiSessionRegistry } from '@/lib/a2ui/processor-store';
import { ClioA2UISurface } from './a2ui-surface';
import { branchTitle, studyViewDomId } from './science-log-model';

/**
 * The study's views: the dashboards its conversations attached with `view`
 * entries, in the server's order (the root's first). Each is its owner's own
 * surface, so its actions go to the conversation that made it.
 */
export function StudyViews({
  study,
  readOnly = false,
}: {
  study: ScienceStudy;
  readOnly?: boolean;
}) {
  const titles = useMemo(
    () => new Map(study.branches.map((branch) => [branch.session_id, branchTitle(branch)])),
    [study],
  );
  // Each owner's catalogs resolve its surface, whichever session this tab belongs to.
  useA2uiSessionRegistry(study.views.map((view) => view.session_id));
  return (
    <div className="grid min-w-0 gap-6">
      {study.views.map((view) => (
        <StudyViewPanel
          key={view.entry}
          owner={
            view.session_id === study.root_session_id
              ? 'the study'
              : titles.get(view.session_id) || view.session_id
          }
          readOnly={readOnly}
          view={view}
        />
      ))}
    </div>
  );
}

function StudyViewPanel({
  view,
  owner,
  readOnly,
}: {
  view: ScienceView;
  owner: string;
  readOnly: boolean;
}) {
  const parsed = useMemo(
    () => (view.surface ? a2uiSurfaceSchema.safeParse(view.surface) : undefined),
    [view.surface],
  );
  return (
    <section
      aria-label={view.title || 'Study view'}
      className="min-w-0 scroll-mt-3 space-y-2"
      data-slot="study-view"
      id={studyViewDomId(view.entry)}
    >
      <header className="space-y-0.5 px-1">
        <h3 className="text-sm font-medium">{view.title || 'Untitled view'}</h3>
        {view.purpose ? <p className="text-xs text-muted-foreground">{view.purpose}</p> : null}
        <p className="text-xs text-muted-foreground">Attached by {owner}</p>
      </header>
      {!view.surface ? (
        <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          The conversation that attached this view has since deleted its dashboard.
        </p>
      ) : parsed?.success ? (
        <div className="overflow-x-auto">
          <ClioA2UISurface readOnly={readOnly} surface={parsed.data} />
        </div>
      ) : (
        <p className="rounded-md border px-3 py-2 text-xs text-destructive" role="alert">
          This view's dashboard could not be read.
        </p>
      )}
    </section>
  );
}
