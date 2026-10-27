import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { WorkbenchTab } from './workbench-shared';

export const scienceLogTab = {
  id: 'science-log',
  kind: 'science-log',
  label: 'Science log',
} as const satisfies WorkbenchTab;

/**
 * The Science log tab exists only while the session belongs to a study. The
 * study read decides: `true` adds the tab once per session (without taking
 * focus), `false` removes it, and an unknown answer (still loading, or no
 * session yet) hides a restored tab without discarding it.
 */
export function useScienceLogTab(
  inStudy: boolean | undefined,
  sessionId: string,
  tabs: readonly WorkbenchTab[],
  setTabs: Dispatch<SetStateAction<WorkbenchTab[]>>,
  activeTabId: string,
): { tabs: WorkbenchTab[]; activeTabId: string } {
  const offered = useRef(new Set<string>());
  useEffect(() => {
    if (inStudy === true && sessionId && !offered.current.has(sessionId)) {
      offered.current.add(sessionId);
      setTabs((current) =>
        current.some((tab) => tab.kind === 'science-log') ? current : [...current, scienceLogTab],
      );
    } else if (inStudy === false) {
      setTabs((current) =>
        current.some((tab) => tab.kind === 'science-log')
          ? current.filter((tab) => tab.kind !== 'science-log')
          : current,
      );
    }
  }, [inStudy, sessionId, setTabs]);
  const shown = inStudy === true ? [...tabs] : tabs.filter((tab) => tab.kind !== 'science-log');
  return {
    tabs: shown,
    activeTabId: shown.some((tab) => tab.id === activeTabId) ? activeTabId : (shown[0]?.id ?? ''),
  };
}
