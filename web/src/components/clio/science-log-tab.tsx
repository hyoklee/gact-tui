import type { ScienceEntry, ScienceStudy, SubagentRun } from '@clio/core/v3';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useOpenTaskHandle } from '@/hooks/use-flow-run';
import { useRepository } from '@/hooks/use-repository';
import { useScienceLog } from '@/hooks/use-science-log';
import { useLiveStore } from '@/store/live-store';
import {
  backlinks,
  branchEntries,
  branchTitle,
  messageForCall,
  scienceEntryDomId,
  studyTree,
  type StudyNode,
} from './science-log-model';
import { ScienceLogPanel } from './science-log-panel';
import { StudyTree } from './study-tree';
import type { SubagentOpenTarget } from './subagent-card';

export interface ScienceLogTabProps {
  sessionId: string;
  workspaceId: string;
  onOpenSubagent: (subagent: SubagentRun, target: SubagentOpenTarget) => void;
  /** Open a folder in the Files view. */
  onOpenFolder?: (path: string) => void;
}

/** The Science log tab: the study tree above, the selected branch's log below. */
export function ScienceLogTab({
  sessionId,
  workspaceId,
  onOpenSubagent,
  onOpenFolder,
}: ScienceLogTabProps) {
  const log = useScienceLog(sessionId);
  const openTask = useOpenTaskHandle(onOpenSubagent);
  const viewInTranscript = useTranscriptJump(sessionId, workspaceId);
  if (log.isPending) return <p className="p-4 text-sm text-muted-foreground">Loading the study…</p>;
  if (log.error)
    return (
      <p className="p-4 text-sm text-destructive" role="alert">
        The science log could not be read: {log.error.message}
      </p>
    );
  if (!log.data.in_study)
    return (
      <p className="p-4 text-sm text-muted-foreground">This session is not part of a study.</p>
    );
  return (
    <ScienceLogView
      onOpenFolder={onOpenFolder}
      onOpenTask={(handle) => openTask.mutate({ handle, target: 'canvas' })}
      onViewInTranscript={(entry) => void viewInTranscript(entry)}
      sessionId={sessionId}
      study={log.data}
    />
  );
}

export interface ScienceLogViewProps {
  study: ScienceStudy;
  /** The session the tab belongs to; its branch is selected first. */
  sessionId: string;
  onOpenTask?: (handle: string) => void;
  onOpenFolder?: (path: string) => void;
  onViewInTranscript?: (entry: ScienceEntry) => void;
}

/** The study tree and one branch's log, with selection kept inside the tab. */
export function ScienceLogView({
  study,
  sessionId,
  onOpenTask,
  onOpenFolder,
  onViewInTranscript,
}: ScienceLogViewProps) {
  const tree = useMemo(() => studyTree(study), [study]);
  const byId = useMemo(() => new Map(study.entries.map((entry) => [entry.id, entry])), [study]);
  const titles = useMemo(
    () => new Map(study.branches.map((branch) => [branch.session_id, branchTitle(branch)])),
    [study],
  );
  const cited = useMemo(() => backlinks(study.entries), [study]);
  const initial = study.branches.some((branch) => branch.session_id === sessionId)
    ? sessionId
    : tree.branch;
  const [selectedBranch, setSelectedBranch] = useState(initial);
  const [focusedEntry, setFocusedEntry] = useState<string>();
  const selectEntry = useCallback(
    (entryId: string) => {
      const entry = byId.get(entryId);
      if (!entry) return;
      if (entry.branch) setSelectedBranch(entry.branch);
      setFocusedEntry(entryId);
    },
    [byId],
  );
  const selectNode = (node: StudyNode) => {
    setSelectedBranch(node.branch);
    setFocusedEntry(node.entry);
  };
  useEffect(() => {
    if (!focusedEntry) return;
    // After the branch switch renders: bring the entry into view without animation.
    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(scienceEntryDomId(focusedEntry));
      card?.scrollIntoView?.({ block: 'nearest' });
      card?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedEntry, selectedBranch]);
  const entries = useMemo(
    () => branchEntries(study.entries, selectedBranch),
    [selectedBranch, study.entries],
  );
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,auto)_minmax(0,1fr)] gap-3 overflow-auto p-3">
      <StudyTree
        onOpenFolder={onOpenFolder}
        onOpenTask={onOpenTask}
        onSelect={selectNode}
        onSelectEntry={selectEntry}
        root={tree}
        selectedBranch={selectedBranch}
      />
      <ScienceLogPanel
        backlinks={cited}
        branchTitle={titles.get(selectedBranch) || selectedBranch}
        byId={byId}
        entries={entries}
        focusedEntry={focusedEntry}
        onSelectEntry={selectEntry}
        onViewInTranscript={onViewInTranscript}
        titles={titles}
      />
    </div>
  );
}

/**
 * Scroll the transcript to the tool call that wrote an entry: in this session
 * through the transcript's own `#message-…/activity-…` anchor, in another branch
 * by opening that session at the same anchor.
 */
function useTranscriptJump(sessionId: string, workspaceId: string) {
  const navigate = useNavigate();
  const repository = useRepository();
  return useCallback(
    async (entry: ScienceEntry) => {
      const session = entry.session || entry.branch;
      const callId = entry.invocation;
      if (!session || !callId) return;
      const loaded = Object.values(useLiveStore.getState().entities.messages);
      let messageId = messageForCall(loaded, session, callId);
      if (!messageId) {
        try {
          messageId = messageForCall(
            (await repository.transcript(session)).messages,
            session,
            callId,
          );
        } catch {
          messageId = undefined;
        }
      }
      if (!messageId) {
        toast.error('The tool call that wrote this entry is not in the transcript.');
        return;
      }
      const hash = `#message-${encodeURIComponent(messageId)}/activity-${encodeURIComponent(callId)}`;
      if (session === sessionId) {
        if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
        else window.location.hash = hash;
        return;
      }
      navigate(
        `/workspaces/${encodeURIComponent(workspaceId)}/sessions/${encodeURIComponent(session)}${hash}`,
      );
    },
    [navigate, repository, sessionId, workspaceId],
  );
}
