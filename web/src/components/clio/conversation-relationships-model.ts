import type { Session } from '@clio/core/v3';
import { isManagedChildSession } from '@/lib/session-state';

export interface ConversationRelationship {
  source: string;
  target: string;
  kind: 'branch' | 'delegation';
}

/** Project the selected conversation's family; ancestry never implies execution ownership. */
export function conversationFamily(sessions: readonly Session[], selectedId: string, limit = 200) {
  const selected = sessions.find((session) => session.id === selectedId);
  if (!selected) return { sessions: [], edges: [], incomplete: true };
  const byId = new Map(
    sessions
      .filter((session) => session.workspace_id === selected.workspace_id)
      .map((session) => [session.id, session]),
  );
  const ancestors = new Set<string>([selectedId]);
  let root = selected;
  let incomplete = false;
  while (root.parent_session_id) {
    const parent = byId.get(root.parent_session_id);
    if (!parent || ancestors.has(parent.id)) {
      incomplete = true;
      break;
    }
    ancestors.add(parent.id);
    root = parent;
  }
  const children = new Map<string, Session[]>();
  for (const session of byId.values()) {
    if (!session.parent_session_id) continue;
    const list = children.get(session.parent_session_id) ?? [];
    list.push(session);
    children.set(session.parent_session_id, list);
  }
  const rows = [root];
  const edges: ConversationRelationship[] = [];
  const visited = new Set([root.id]);
  for (let index = 0; index < rows.length; index++) {
    const parent = rows[index]!;
    for (const child of (children.get(parent.id) ?? []).sort(
      (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    )) {
      if (visited.has(child.id)) {
        incomplete = true;
        continue;
      }
      if (rows.length >= limit && !ancestors.has(child.id)) {
        incomplete = true;
        continue;
      }
      visited.add(child.id);
      rows.push(child);
      edges.push({
        source: parent.id,
        target: child.id,
        kind: isManagedChildSession(child) ? 'delegation' : 'branch',
      });
    }
  }
  return { sessions: rows, edges, incomplete };
}
