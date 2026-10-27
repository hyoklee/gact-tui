import type { ScienceEntry } from '@clio/core/v3';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  conversationForkOrigin,
  forkAuthorLabel,
} from '@/components/clio/conversation-fork-origin';
import { messageForCall } from '@/components/clio/science-log-model';
import { ScienceLogView } from '@/components/clio/science-log-tab';
import { PluginViewList, PluginViewsSection } from '@/components/clio/plugin-views-panel';
import { ClioStatus } from '@/components/clio/status';
import { useRepository } from '@/hooks/use-repository';
import { usePluginViews } from '@/hooks/use-plugin-views';
import { useScienceLog } from '@/hooks/use-science-log';
import type { PluginViewSession } from '@/lib/plugin-view-model';
import type { ArchiveTranscriptView } from './archive-conversation';
import {
  archiveFileHref,
  archiveFolderPath,
  type ArchiveFileInventory,
} from './archive-file-reference';
import {
  archiveSpawn,
  decodedMessages,
  type ArchiveSessionRow,
  type ArchiveTarget,
} from './archive-orchestration-model';

/**
 * What a child session is in the archive, above its transcript: how it was
 * reached (delegated or forked, and by whom), its agent and model, what it was
 * asked and what it returned, with a link back to where it was started.
 */
export function ArchiveSessionHeader({
  row,
  parentTitle,
  parentView,
  onOpen,
}: {
  row: ArchiveSessionRow;
  parentTitle: string;
  parentView?: ArchiveTranscriptView;
  onOpen: (target: ArchiveTarget) => void;
}) {
  const repository = useRepository();
  const sessionId = row.session.id;
  const session = useQuery({
    queryKey: ['archive-session-record', sessionId],
    queryFn: ({ signal }) => repository.sessionRecord(sessionId, signal),
    retry: false,
    staleTime: Infinity,
  });
  const relationship = row.relationship;
  const spawn = useMemo(() => archiveSpawn(sessionId, parentView), [parentView, sessionId]);
  if (!relationship) return null;
  const origin = conversationForkOrigin(session.data);
  const forked = relationship.attribution === 'session_fork' || Boolean(origin);
  const author = forkAuthorLabel(origin);
  const agent = spawn.subagent?.agent_id || session.data?.agent_id || '';
  const model = [session.data?.provider_id, session.data?.model_id].filter(Boolean).join(' / ');
  const parent = relationship.parent_session_id;
  return (
    <header
      aria-label={`How ${row.session.title || sessionId} was started`}
      className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm"
      data-slot="archive-session-origin"
    >
      <p>
        {forked ? 'Forked from ' : 'Delegated by '}
        <button
          className="font-medium underline"
          onClick={() => onOpen({ sessionId: parent, messageId: spawn.messageId })}
          type="button"
        >
          {parentTitle || parent}
        </button>
        {spawn.messageId ? ' — back to where it was started' : ''}
      </p>
      {author ? <p>{author}</p> : null}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        {agent ? (
          <>
            <dt className="text-muted-foreground">Agent</dt>
            <dd>{agent}</dd>
          </>
        ) : null}
        {model ? (
          <>
            <dt className="text-muted-foreground">Model</dt>
            <dd>{model}</dd>
          </>
        ) : null}
        {spawn.subagent ? (
          <>
            <dt className="text-muted-foreground">State</dt>
            <dd>
              <ClioStatus value={spawn.subagent.state} />
            </dd>
          </>
        ) : null}
        {spawn.subagent?.task ? (
          <>
            <dt className="text-muted-foreground">Assignment</dt>
            <dd className="whitespace-pre-wrap">{spawn.subagent.task}</dd>
          </>
        ) : null}
        {spawn.subagent?.result ? (
          <>
            <dt className="text-muted-foreground">Result</dt>
            <dd className="whitespace-pre-wrap">{spawn.subagent.result}</dd>
          </>
        ) : null}
      </dl>
    </header>
  );
}

/**
 * The study's Science log in the archive: its views, tree and log, with
 * citations followable to the entry and to the transcript turn that wrote it;
 * each Observation's sources and each analysis followable to the cited call's
 * turn, cited files and node folders linked to the files the export includes.
 */
export function ArchiveScienceLog({
  sessionId,
  views,
  inventory,
  onOpen,
  onOpenFolder,
}: {
  sessionId: string;
  views: Readonly<Record<string, ArchiveTranscriptView>>;
  /** The export's included files, to link cited files and node folders to them. */
  inventory?: ArchiveFileInventory;
  onOpen: (target: ArchiveTarget) => void;
  /** Show an included folder's files (the export's Files section). */
  onOpenFolder?: (path: string) => void;
}) {
  const log = useScienceLog(sessionId);
  if (!log.data?.in_study) return null;
  const study = log.data;
  const viewInTranscript = (entry: ScienceEntry) => {
    const session = entry.session || entry.branch;
    if (!session) return;
    const messageId = entry.invocation
      ? messageForCall(decodedMessages(views[session]), session, entry.invocation)
      : undefined;
    onOpen({ sessionId: session, messageId, callId: entry.invocation || undefined });
  };
  const viewCall = (session: string, callId: string) =>
    onOpen({
      sessionId: session,
      messageId: messageForCall(decodedMessages(views[session]), session, callId),
      callId,
    });
  return (
    <ScienceLogView
      onOpenTask={(handle) => {
        const branch = study.branches.find((row) => row.handle === handle);
        if (branch) onOpen({ sessionId: branch.session_id });
      }}
      fileHref={
        inventory
          ? (file) =>
              (file.artifactId
                ? archiveFileHref(`artifact://${file.artifactId}`, inventory)
                : undefined) ?? (file.path ? archiveFileHref(file.path, inventory) : undefined)
          : undefined
      }
      folderAvailable={(path) =>
        Boolean(inventory && archiveFolderPath(path, inventory) !== undefined)
      }
      onOpenFolder={onOpenFolder}
      onViewCall={viewCall}
      onViewInTranscript={viewInTranscript}
      sessionId={sessionId}
      study={study}
      views={<PluginViewsSection sessionId={sessionId} />}
    />
  );
}

/** The archive's views outside a study: those of the exported sessions. */
export function ArchiveViews({
  sessionId,
  sessions,
}: {
  sessionId: string;
  sessions: readonly PluginViewSession[];
}) {
  const { views } = usePluginViews(sessionId, { sessions });
  if (!views.length) return null;
  return <PluginViewList views={views} />;
}
