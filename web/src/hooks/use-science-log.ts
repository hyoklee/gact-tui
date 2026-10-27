import { useQuery } from '@tanstack/react-query';
import { useRepository } from '@/hooks/use-repository';
import { queryKeys } from '@/lib/query-keys';
import { useConnectionSettings } from '@/providers/connection-provider';

/** The cache key of one session's science log read. */
export function scienceLogQueryKey(endpoint: string, sessionId: string) {
  return queryKeys.key('science-log', endpoint, sessionId);
}

/**
 * The study a session belongs to, or `in_study: false`. Live `science.entry`
 * events merge into this read (see `lib/streaming/science-log-updates.ts`).
 */
export function useScienceLog(sessionId: string, enabled = true) {
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  return useQuery({
    queryKey: scienceLogQueryKey(settings.endpoint, sessionId),
    enabled: Boolean(sessionId) && enabled,
    queryFn: ({ signal }) => repository.scienceLog(sessionId, signal),
    retry: false,
  });
}
