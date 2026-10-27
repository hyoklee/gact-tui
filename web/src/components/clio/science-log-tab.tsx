import type { ScienceEntry, ScienceStudy, SubagentRun } from '@clio/core/v3';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import type { ScienceFileReference } from './science-log-sources';
import { PluginViewsSection } from './plugin-views-panel';
import { StudyTree } from './study-tree';
import { StudyGraph } from './study-graph';
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
      onViewCall={(session, callId) => void viewInTranscript(session, callId)}
      onViewInTranscript={(entry) =>
        void viewInTranscript(entry.session || entry.branch, entry.invocation)
      }
      sessionId={sessionId}
      study={log.data}
      views={<PluginViewsSection sessionId={sessionId} />}
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
  /** Scroll the transcript to a call an entry cites (a source or an analysis). */
  onViewCall?: (sessionId: string, callId: string) => void;
  /** A link to a cited file, when this surface carries it. */
  fileHref?: (file: ScienceFileReference) => string | undefined;
  /** Whether a node folder can be opened here; without it every folder opens. */
  folderAvailable?: (path: string) => boolean;
  /** The study's plugin views, drawn above the tree. */
  views?: ReactNode;
}

/** The study tree and one branch's log, with selection kept inside the tab. */
export function ScienceLogView({
  study,
  sessionId,
  onOpenTask,
  onOpenFolder,
  onViewInTranscript,
  onViewCall,
  fileHref,
  folderAvailable,
  views,
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
  const [studyView, setStudyView] = useState('tree');
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
    // One scrolling column: views, tree and log each keep their full height, so a
    // long tree never runs under the log below it.
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-auto p-3 [&>*]:shrink-0">
      {views}
      <ToggleGroup
        aria-label="Study view"
        type="single"
        value={studyView}
        onValueChange={(value) => {
          if (value) setStudyView(value);
        }}
        variant="outline"
        size="sm"
        spacing={0}
      >
        <ToggleGroupItem value="tree">Tree</ToggleGroupItem>
        <ToggleGroupItem value="graph">Graph</ToggleGroupItem>
      </ToggleGroup>
      {studyView === 'graph' ? (
        <StudyGraph study={study} selectedEntry={focusedEntry} onSelectEntry={selectEntry} />
      ) : (
        <StudyTree
          folderAvailable={folderAvailable}
          onOpenFolder={onOpenFolder}
          onOpenTask={onOpenTask}
          onSelect={selectNode}
          onSelectEntry={selectEntry}
          root={tree}
          selectedBranch={selectedBranch}
        />
      )}
      <ScienceLogPanel
        backlinks={cited}
        branchTitle={titles.get(selectedBranch) || selectedBranch}
        byId={byId}
        entries={entries}
        focusedEntry={focusedEntry}
        onSelectEntry={selectEntry}
        fileHref={fileHref}
        onViewCall={onViewCall}
        onViewInTranscript={onViewInTranscript}
        titles={titles}
      />
    </div>
  );
}

/**
 * Scroll the transcript to a recorded tool call (the one that wrote an entry, or
 * one an entry cites): in this session
 * through the transcript's own `#message-…/activity-…` anchor, in another branch
 * by opening that session at the same anchor.
 */
function useTranscriptJump(sessionId: string, workspaceId: string) {
  const navigate = useNavigate();
  const repository = useRepository();
  return useCallback(
    async (session: string, callId: string) => {
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
        toast.error('That tool call is not in the transcript.');
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
