import {
  messageSchema,
  subagentSchema,
  toolInvocationSchema,
  type Message,
  type SubagentRun,
} from '@clio/core/v3';
import { subagentsForTool } from '@/components/clio/subagent-tool-link';
import { usePluginViews } from '@/hooks/use-plugin-views';
import { useScienceLog } from '@/hooks/use-science-log';
import type { PluginViewSession } from '@/lib/plugin-view-model';
import type { ArchiveTranscriptView } from './archive-conversation';

/** How a descendant was reached, as the export recorded it. */
export interface ArchiveRelationship {
  session_id: string;
  parent_session_id: string;
  depth?: number;
  attribution?: string;
  task_id?: string;
}

export interface ArchiveSessionRow {
  session: { id: string; title: string };
  relationship?: ArchiveRelationship;
}

/** Where to go in the archive: a session's section, or one message (and call) in it. */
export interface ArchiveTarget {
  sessionId: string;
  messageId?: string;
  callId?: string;
}

/** The DOM id of a message row, as the conversation renders it. */
export function archiveMessageDomId(messageId: string): string {
  return `message-${messageId}`;
}

export function decodedMessages(view: ArchiveTranscriptView | undefined): Message[] {
  return (view?.messages ?? []).flatMap((value) => {
    const result = messageSchema.safeParse(value);
    return result.success ? [result.data] : [];
  });
}

/**
 * The spawn behind a child session: the parent's subagent record for it and the
 * parent message that shows that spawn, when the parent's transcript has one.
 */
export function archiveSpawn(
  childId: string,
  parentView: ArchiveTranscriptView | undefined,
): { subagent?: SubagentRun; messageId?: string } {
  const subagent = (parentView?.subagents ?? [])
    .flatMap((value) => {
      const result = subagentSchema.safeParse(value);
      return result.success ? [result.data] : [];
    })
    .find((row) => row.child_session_id === childId);
  if (!subagent) return {};
  const tools = new Map(
    (parentView?.tools ?? []).flatMap((value) => {
      const result = toolInvocationSchema.safeParse(value);
      return result.success ? [[result.data.id, result.data] as const] : [];
    }),
  );
  const byId = { [subagent.id]: subagent };
  const message = decodedMessages(parentView).find((row) =>
    row.blocks.some(
      (block) =>
        (block.type === 'subagent' && block.subagent_id === subagent.id) ||
        (block.type === 'tool' && subagentsForTool(tools.get(block.tool_id), byId).length > 0),
    ),
  );
  return { subagent, messageId: message?.id };
}

/** Whether the archive has a study, or views outside one, to offer as a section. */
export function useArchiveSections(
  sessionId: string,
  sessions: readonly PluginViewSession[],
): { science: boolean; views: boolean } {
  const log = useScienceLog(sessionId);
  const inStudy = log.data?.in_study === true;
  const { views } = usePluginViews(sessionId, { sessions, enabled: log.data?.in_study === false });
  return { science: inStudy, views: !inStudy && views.length > 0 };
}
