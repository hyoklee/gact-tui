import type { ScienceBranch, Session } from '@clio/core/v3';
import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useRepository } from '@/hooks/use-repository';
import { useScienceLog } from '@/hooks/use-science-log';
import { branchTitle } from '@/components/clio/science-log-model';
import { mergePluginViews, type PluginView, type PluginViewSession } from '@/lib/plugin-view-model';
import { withCurrentLaw } from '@/lib/plugin-view-shadow';
import { queryKeys } from '@/lib/query-keys';
import { isSessionActive } from '@/lib/session-state';
import { useConnectionSettings } from '@/providers/connection-provider';
import { useLiveStore } from '@/store/live-store';

/** Cadence for re-reading the tree's other sessions while any runs. Unit: milliseconds. */
export const PLUGIN_VIEW_POLL_MS = 4_000;

/** The cache key of one session's plugin view events. */
export function pluginViewEventsQueryKey(endpoint: string, sessionId: string) {
  return queryKeys.key('plugin-view-events', endpoint, sessionId);
}

const RUNNING_TASK_STATES = new Set(['running', 'queued', 'busy', 'executing']);

/** A study's branches as the sessions its views may come from. */
export function studyViewSessions(branches: readonly ScienceBranch[]): PluginViewSession[] {
  return branches.map((branch) => ({
    id: branch.session_id,
    title: branchTitle(branch),
    running: RUNNING_TASK_STATES.has(branch.task_status),
  }));
}

/** The session and every session below it, by `parent_session_id`, breadth first. */
export function descendantViewSessions(
  sessions: Readonly<Record<string, Session>>,
  rootId: string,
): PluginViewSession[] {
  const children = new Map<string, Session[]>();
  for (const session of Object.values(sessions)) {
    if (!session.parent_session_id) continue;
    children.set(session.parent_session_id, [
      ...(children.get(session.parent_session_id) ?? []),
      session,
    ]);
  }
  const rows: PluginViewSession[] = [];
  const seen = new Set<string>();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const session = sessions[id];
    rows.push({
      id,
      title: session?.title ?? '',
      running: session ? isSessionActive(session.state) : false,
    });
    for (const child of children.get(id) ?? []) queue.push(child.id);
  }
  return rows;
}

/** Hold a value until the next display frame, so bursts of updates paint once. */
function useFrameValue<T>(value: T): T {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (Object.is(shown, value)) return;
    const frame = window.requestAnimationFrame(() => setShown(value));
    return () => window.cancelAnimationFrame(frame);
  }, [shown, value]);
  return shown;
}

export interface PluginViewsState {
  views: PluginView[];
  /** The sessions read (those whose catalogs include a plugin catalog). */
  sessions: PluginViewSession[];
  pending: boolean;
}

/**
 * The plugin views of a session's tree: a study's branches when the session is
 * in a study, else the session and its descendants (or `sessions`, when the
 * caller already knows the tree). Only sessions with a plugin catalog are read.
 * The session itself is refreshed by its live stream; the others are re-read
 * while any session of the tree runs.
 */
export function usePluginViews(
  sessionId: string,
  options: { sessions?: readonly PluginViewSession[]; enabled?: boolean } = {},
): PluginViewsState {
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const enabled = Boolean(sessionId) && options.enabled !== false;
  const study = useScienceLog(sessionId, enabled);
  const liveSessions = useLiveStore((state) => state.entities.sessions);
  const branches = study.data?.in_study ? study.data.branches : undefined;
  // Callers may pass a fresh list each render; its content, not its identity, keys the tree.
  const given = options.sessions ? JSON.stringify(options.sessions) : '';
  const tree = useMemo(
    () =>
      given
        ? (JSON.parse(given) as PluginViewSession[])
        : branches
          ? studyViewSessions(branches)
          : descendantViewSessions(liveSessions, sessionId),
    [branches, given, liveSessions, sessionId],
  );
  const catalogs = useQueries({
    queries: tree.map((session) => ({
      // The A2UI registry's own key: one catalog read per session serves both.
      queryKey: ['a2ui-catalogs', session.id],
      enabled,
      queryFn: ({ signal }: { signal: AbortSignal }) => repository.a2uiCatalogs(session.id, signal),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const readable = tree.filter((_, index) =>
    catalogs[index]?.data?.rows.some((row) => row.source === 'plugin' && row.producible),
  );
  const running = tree.some((session) => session.running);
  const events = useQueries({
    queries: readable.map((session) => ({
      queryKey: pluginViewEventsQueryKey(settings.endpoint, session.id),
      enabled,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        repository.pluginViewEvents(session.id, signal),
      retry: false,
      refetchInterval: running && session.id !== sessionId ? PLUGIN_VIEW_POLL_MS : false,
    })),
  });
  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of Object.values(liveSessions))
      if (session.title) map.set(session.id, session.title);
    for (const session of tree) if (session.title) map.set(session.id, session.title);
    return map;
  }, [liveSessions, tree]);
  // A read's update time changes exactly when its data does, so it keys the merge.
  const updated = events.map((query) => query.dataUpdatedAt).join(',');
  const merged = useMemo(
    () =>
      mergePluginViews(
        events.flatMap((query) => query.data ?? []),
        titles,
      ),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [titles, updated],
  );
  // The study's current law is drawn beside the rows; a new or changed
  // hypothesis (live `science.entry` events update this read) redraws it.
  const entries = study.data?.in_study ? study.data.entries : undefined;
  const views = useMemo(
    () => (entries ? withCurrentLaw(merged, entries) : merged),
    [entries, merged],
  );
  const shown = useFrameValue(views);
  return {
    views: shown,
    sessions: readable,
    pending:
      study.isPending ||
      catalogs.some((query) => query.isPending) ||
      events.some((query) => query.isPending),
  };
}
