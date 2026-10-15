import type { InfrastructureInventory } from '@clio/core/v3';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ModelDownloadProgress } from './model-download-progress';
import { infrastructureServiceName } from '@/lib/infrastructure-service-labels';

/** Recent operations in one timeline; host and result stay visible before opening details. */
export function InfrastructureActivity({ data }: { data: InfrastructureInventory }) {
  const [search, setSearch] = useState('');
  const hosts = new Map(
    data.targets.map((host) => [host.id, host.kind === 'local' ? 'Local' : host.label]),
  );
  const rows = [
    ...data.operations.map((operation) => ({
      id: operation.id,
      target: operation.target_id,
      title: `${operation.action.replaceAll('_', ' ')} ${infrastructureServiceName(operation.service_id)}`,
      state: operation.state,
      time: new Date(operation.updated_at).getTime(),
      detail: operation.error || operation.progress,
      logs: operation.logs,
      model: undefined,
    })),
    ...data.model_acquisitions.map((model) => ({
      id: model.id,
      target: model.target_id || 'local',
      title: `Download ${model.repository}`,
      state: model.state,
      time: model.updated_at * 1000,
      detail: model.error || model.phase,
      logs: undefined,
      model,
    })),
  ]
    .sort((a, b) => b.time - a.time)
    .filter((row) =>
      `${row.title} ${row.state} ${hosts.get(row.target)}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
    );
  return (
    <section className="mt-6" aria-label="Infrastructure activity">
      <Input
        aria-label="Search activity"
        placeholder="Search actions, computers or results"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="mt-4 divide-y border-y">
        {rows.length ? (
          rows.map((row) => (
            <details className="group py-3" key={`${row.target}:${row.id}`}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 font-medium text-sm">
                  {row.title.charAt(0).toLocaleUpperCase() + row.title.slice(1)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {hosts.get(row.target) || row.target}
                </span>
                <Badge variant={row.state === 'failed' ? 'destructive' : 'outline'}>
                  {(
                    {
                      succeeded: 'Completed',
                      ready: 'Ready',
                      running: 'Running',
                      queued: 'Queued',
                      failed: 'Failed',
                      cancelled: 'Cancelled',
                      removed: 'Removed',
                    } as Record<string, string>
                  )[row.state] || row.state}
                </Badge>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={new Date(row.time).toISOString()}
                >
                  {new Date(row.time).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
                <span className="text-xs text-primary group-open:hidden">Details</span>
                <span className="hidden text-xs text-primary group-open:inline">Hide details</span>
              </summary>
              <div className="mt-3 space-y-3">
                {row.model && ['running', 'queued'].includes(row.state) ? (
                  <ModelDownloadProgress model={row.model} />
                ) : (
                  <p className="text-sm text-muted-foreground">{row.detail}</p>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link
                    to={`/infrastructure/${row.model ? 'models' : 'services'}?target=${encodeURIComponent(row.target)}`}
                  >
                    {row.model ? 'Open models' : 'Open services'}
                  </Link>
                </Button>
                {row.logs ? (
                  <pre className="clio-scrollbar max-h-72 overflow-auto whitespace-pre-wrap break-all bg-muted/40 p-3 text-xs">
                    {row.logs}
                  </pre>
                ) : null}
              </div>
            </details>
          ))
        ) : (
          <p className="py-6 text-sm text-muted-foreground">
            {search
              ? 'No matching activity.'
              : 'No infrastructure operations yet. Install or start a service to see its progress here.'}
          </p>
        )}
      </div>
    </section>
  );
}
