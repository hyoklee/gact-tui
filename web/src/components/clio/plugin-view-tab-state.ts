import type { Dispatch, SetStateAction } from 'react';
import { usePluginViews } from '@/hooks/use-plugin-views';
import { useScienceLog } from '@/hooks/use-science-log';
import { useOfferedTab } from './science-log-tab-state';
import type { WorkbenchTab } from './workbench-shared';

export const pluginViewsTab = {
  id: 'plugin-views',
  kind: 'plugin-views',
  label: 'Views',
} as const satisfies WorkbenchTab;

/**
 * What a session's canvas offers beside Work: the Science log when it is in a
 * study, else Views when its tree has recorded plugin views (a study shows its
 * views in the Science log instead). `undefined` is not known yet.
 */
export function useCanvasStudy(sessionId: string): {
  inStudy?: boolean;
  pluginViews?: boolean;
} {
  const study = useScienceLog(sessionId);
  const inStudy = study.data?.in_study;
  const { views, pending } = usePluginViews(sessionId, { enabled: inStudy === false });
  const pluginViews =
    inStudy === true
      ? false
      : inStudy === false
        ? views.length
          ? true
          : pending
            ? undefined
            : false
        : undefined;
  return { inStudy, pluginViews };
}

/**
 * The Views tab: offered once, when the first view of the session's tree
 * arrives; removed when the session has none or turns out to be in a study.
 */
export function usePluginViewTab(
  pluginViews: boolean | undefined,
  sessionId: string,
  tabs: readonly WorkbenchTab[],
  setTabs: Dispatch<SetStateAction<WorkbenchTab[]>>,
  activeTabId: string,
): { tabs: WorkbenchTab[]; activeTabId: string } {
  return useOfferedTab(pluginViewsTab, pluginViews, sessionId, tabs, setTabs, activeTabId);
}
