import type { WorkspaceResource } from '@clio/core/v3';
import { useMemo } from 'react';

/** Keep the transcript's immutable resource lookup stable across unrelated renders. */
export function useWorkspaceResourceMap(resources: readonly WorkspaceResource[] | undefined) {
  return useMemo(
    () => Object.fromEntries((resources ?? []).map((resource) => [resource.id, resource])),
    [resources],
  );
}
