import type { Session } from '@clio/core/v3';

export interface ConversationForkOrigin {
  session_id: string;
  message_id: string;
  message_count: number;
  created_at: string;
  title?: string;
}

/** Read a saved checkpoint; never guess the boundary from the parent's current history. */
export function conversationForkOrigin(session?: Session): ConversationForkOrigin | undefined {
  const raw = session?.metadata?.['fork_origin'];
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  if (
    value['session_id'] !== session?.parent_session_id ||
    typeof value['session_id'] !== 'string' ||
    !value['session_id'] ||
    typeof value['message_id'] !== 'string' ||
    typeof value['message_count'] !== 'number' ||
    !Number.isInteger(value['message_count']) ||
    value['message_count'] < 0 ||
    Boolean(value['message_id']) !== Boolean(value['message_count']) ||
    typeof value['created_at'] !== 'string' ||
    !value['created_at']
  )
    return undefined;
  return {
    session_id: value['session_id'],
    message_id: value['message_id'],
    message_count: value['message_count'],
    created_at: value['created_at'],
    title: typeof value['title'] === 'string' ? value['title'] : undefined,
  };
}
