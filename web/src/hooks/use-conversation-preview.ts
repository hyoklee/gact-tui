import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { sessionArtifactEntities } from '@/lib/session-artifacts';
import { useConnectionSettings } from '@/providers/connection-provider';
import { useRepository } from './use-repository';

/** Fetch just the selected conversation; never fan out over the whole family. */
export function useConversationPreview(sessionId: string) {
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const transcript = useQuery({
    queryKey: queryKeys.key('transcript', settings.endpoint, sessionId),
    queryFn: ({ signal }) => repository.transcript(sessionId, signal),
    enabled: Boolean(sessionId),
    staleTime: 5000,
  });
  const artifacts = useQuery({
    queryKey: queryKeys.key('session-artifacts', settings.endpoint, sessionId),
    queryFn: ({ signal }) => repository.sessionArtifacts(sessionId, signal),
    enabled: Boolean(sessionId),
    staleTime: 5000,
  });
  return {
    messages: transcript.data?.messages ?? [],
    outputs: sessionArtifactEntities(artifacts.data, [], sessionId).filter(
      (artifact) =>
        artifact.session_relation !== 'used' &&
        (!artifact.producer?.['session_id'] || artifact.producer['session_id'] === sessionId),
    ),
    pending: transcript.isPending,
    error: transcript.error,
    outputsError: artifacts.error,
  };
}
