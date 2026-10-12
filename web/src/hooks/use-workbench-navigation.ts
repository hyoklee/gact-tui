import type {
  Artifact,
  Session,
  SessionDiff,
  SubagentRun,
  ToolInvocation,
  WorkspaceResource,
} from '@clio/core/v3';
import { useCallback, useEffect, useState } from 'react';
import { connectionScope } from '@/lib/connection-scope';
import { KNOWLEDGE_OPEN_EVENT, type KnowledgeOpenRequest } from '@/lib/knowledge-navigation';
import { useNavigate } from 'react-router-dom';
import type { SubagentOpenTarget } from '@/components/clio/subagent-card';
import type { ClioWorkbenchOpenRequest } from '@/components/clio/workbench';
import { useConnectionSettings } from '@/providers/connection-provider';
import { workspaceFilePath } from '@/lib/workspace-file-path';
import { useLiveStore } from '@/store/live-store';

interface UseWorkbenchNavigationInput {
  allSessions: readonly Session[];
  workspaceId: string;
}

interface WorkbenchRequest {
  endpoint: string;
  key: string;
  request: ClioWorkbenchOpenRequest;
}

/** Owns central-versus-canvas navigation for workspace resources and child sessions. */
export function useWorkbenchNavigation({ allSessions, workspaceId }: UseWorkbenchNavigationInput) {
  const navigate = useNavigate();
  const { settings } = useConnectionSettings();
  const workspacePath = useLiveStore((state) => state.entities.workspaces[workspaceId]?.path);
  const [workbenchRequest, setWorkbenchRequest] = useState<WorkbenchRequest>();

  const revealWorkbench = useCallback(
    (request: ClioWorkbenchOpenRequest) => {
      setWorkbenchRequest({
        endpoint: settings.endpoint,
        key: `${request.kind}:${Date.now()}`,
        request,
      });
    },
    [settings.endpoint],
  );

  const openSubagent = useCallback(
    (subagent: SubagentRun, target: SubagentOpenTarget) => {
      if (!subagent.child_session_id) return;
      if (target === 'canvas') {
        revealWorkbench({ kind: 'subagent', subagent });
        return;
      }
      const child = allSessions.find((item) => item.id === subagent.child_session_id);
      void navigate(
        `/workspaces/${encodeURIComponent(child?.workspace_id ?? workspaceId)}/sessions/${encodeURIComponent(subagent.child_session_id)}`,
      );
    },
    [allSessions, navigate, revealWorkbench, workspaceId],
  );

  useEffect(() => {
    const open = (event: Event) => {
      const request = (event as CustomEvent<KnowledgeOpenRequest>).detail;
      if (request.workspaceId === workspaceId && request.scope === connectionScope(settings)) {
        revealWorkbench({ kind: 'knowledge', sourceId: request.sourceId, label: request.label });
      }
    };
    window.addEventListener(KNOWLEDGE_OPEN_EVENT, open);
    return () => window.removeEventListener(KNOWLEDGE_OPEN_EVENT, open);
  }, [workspaceId, settings, revealWorkbench]);

  const openArtifact = useCallback(
    (artifact: Artifact) => revealWorkbench({ kind: 'artifact', artifact }),
    [revealWorkbench],
  );
  const openWorkspaceFile = useCallback(
    (path: string) =>
      revealWorkbench({ kind: 'workspace-file', path: workspaceFilePath(path, workspacePath) }),
    [revealWorkbench, workspacePath],
  );
  const openWorkspaceResource = useCallback(
    (resource: WorkspaceResource, relatedResources?: readonly WorkspaceResource[]) =>
      revealWorkbench({ kind: 'resource', relatedResources, resource }),
    [revealWorkbench],
  );
  const openDiff = useCallback(
    (diff: SessionDiff) => revealWorkbench({ kind: 'diff', diff }),
    [revealWorkbench],
  );
  const openWorkflow = useCallback(
    (tool: ToolInvocation) => revealWorkbench({ kind: 'workflow', tool }),
    [revealWorkbench],
  );

  const openParentSession = useCallback((session: Session) => {
    if (!session.parent_session_id) return;
    const parent = allSessions.find((candidate) => candidate.id === session.parent_session_id);
    navigate(`/workspaces/${encodeURIComponent(parent?.workspace_id ?? workspaceId)}/sessions/${encodeURIComponent(session.parent_session_id)}`);
  }, [allSessions, navigate, workspaceId]);

  const activeRequest =
    workbenchRequest?.endpoint === settings.endpoint ? workbenchRequest : undefined;

  return {
    activeRequest,
    openArtifact,
    openDiff,
    openParentSession,
    openSubagent,
    openWorkflow,
    openWorkspaceFile,
    openWorkspaceResource,
    revealWorkbench,
  };
}
