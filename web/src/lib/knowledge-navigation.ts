import type { ConnectedSourceState, WorkspaceResource } from '@clio/core/v3';

export const KNOWLEDGE_OPEN_EVENT = 'clio:open-knowledge';
export const KNOWLEDGE_ATTACH_EVENT = 'clio:attach-knowledge';
export interface KnowledgeOpenRequest {
  scope: string;
  workspaceId: string;
  sourceId: string;
  label: string;
}
export interface KnowledgeAttachRequest {
  scope: string;
  workspaceId: string;
  resource: WorkspaceResource;
}

export function openKnowledge(scope: string, workspaceId: string, source: ConnectedSourceState) {
  window.dispatchEvent(
    new CustomEvent<KnowledgeOpenRequest>(KNOWLEDGE_OPEN_EVENT, {
      detail: { scope, workspaceId, sourceId: source.id, label: source.label },
    }),
  );
}
