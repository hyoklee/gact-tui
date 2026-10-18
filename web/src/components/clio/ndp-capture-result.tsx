import { Link } from 'react-router-dom';
import type { NDPEndpointCapture } from '@clio/core/v3';
import { useConnectionSettings } from '@/providers/connection-provider';
import { connectionScope } from '@/lib/connection-scope';

export function NDPCaptureResult({
  capture,
  workspaceId,
}: {
  capture: NDPEndpointCapture;
  workspaceId: string;
}) {
  const { settings } = useConnectionSettings();
  return (
    <div aria-label="Saved endpoint data" className="space-y-2 text-sm">
      <p role="status">
        Saved {capture.bytes_received.toLocaleString()} bytes ·{' '}
        {capture.stop_reason.replaceAll('_', ' ')}
      </p>
      <pre className="max-h-44 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
        {capture.preview}
      </pre>
      {capture.workspace_path ? (
        <Link
          className="underline"
          to={`/workspaces/${encodeURIComponent(workspaceId)}/new`}
          state={{
            globalSearchResource: {
              scope: connectionScope(settings),
              request: { kind: 'workspace-file', path: capture.workspace_path },
            },
          }}
        >
          Open saved data
        </Link>
      ) : null}
      {capture.materialization?.state === 'failed' ? (
        <p role="alert" className="text-destructive">
          {capture.materialization.reason}
        </p>
      ) : null}
    </div>
  );
}
