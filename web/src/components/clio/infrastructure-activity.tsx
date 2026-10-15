import type { InfrastructureInventory } from '@clio/core/v3';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ModelDownloadProgress } from './model-download-progress';
import { infrastructureServiceName } from '@/lib/infrastructure-service-labels';
import { ChevronDownIcon } from 'lucide-react';
import { TechnicalDetails } from './technical-details';

type ActivityFilter = 'all' | 'active' | 'failed' | 'completed';
const activeStates = new Set(['queued', 'running']);
const completedStates = new Set(['succeeded', 'ready']);
const stateLabels: Record<string, string> = {
  succeeded: 'Completed',
  ready: 'Completed',
  running: 'Running',
  queued: 'Queued',
  failed: 'Failed',
  cancelled: 'Cancelled',
  removed: 'Removed',
};

/** Keep the service's short reason visible and preserve long diagnostics in full. */
function activitySummary(detail: string | undefined): string | undefined {
  if (!detail || detail.length <= 320) return detail;
  const firstSentence = detail.split(/\n|(?<=\.)\s/u)[0];
  return firstSentence.length <= 320
    ? firstSentence
    : 'Open technical details for the full operation output.';
}

/** Recent operations in one timeline; host and result stay visible before opening details. */
export function InfrastructureActivity({ data }: { data: InfrastructureInventory }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const hosts = new Map(
    data.targets.map((host) => [host.id, host.kind === 'local' ? 'Local' : host.label]),
  );
  const history = [
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
      `${row.title} ${stateLabels[row.state] || row.state} ${hosts.get(row.target)} ${row.detail}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    );
  const matchesFilter = (state: string, selected: ActivityFilter) =>
    selected === 'all' ||
    (selected === 'active'
      ? activeStates.has(state)
      : selected === 'completed'
        ? completedStates.has(state)
        : state === 'failed');
  const rows = history.filter((row) => matchesFilter(row.state, filter));
  return (
    <section className="mt-6" aria-label="Infrastructure activity">
      <Input
        aria-label="Search activity"
        placeholder="Search actions, computers or results"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div aria-label="Activity status" className="mt-3 flex flex-wrap items-center gap-2">
        {(['all', 'active', 'failed', 'completed'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'secondary' : 'ghost'}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {{ all: 'All', active: 'In progress', failed: 'Failed', completed: 'Completed' }[value]}{' '}
            <span className="text-xs tabular-nums text-muted-foreground">
              {history.filter((row) => matchesFilter(row.state, value)).length}
            </span>
          </Button>
        ))}
      </div>
      <div className="mt-4 divide-y border-y">
        {rows.length ? (
          rows.map((row) => (
            <details className="group py-3" key={`${row.target}:${row.id}`}>
              <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:flex sm:flex-wrap">
                <span className="min-w-0 break-words font-medium text-sm sm:flex-1">
                  {row.title.charAt(0).toLocaleUpperCase() + row.title.slice(1)}
                </span>
                <span className="col-start-1 row-start-2 text-xs text-muted-foreground">
                  {hosts.get(row.target) || row.target}
                </span>
                <Badge variant={row.state === 'failed' ? 'destructive' : 'outline'}>
                  {stateLabels[row.state] || row.state}
                </Badge>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={new Date(row.time).toISOString()}
                  title={new Date(row.time).toLocaleString()}
                >
                  {new Date(row.time).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="hidden size-4 text-muted-foreground group-open:rotate-180 sm:block"
                />
                {row.model && activeStates.has(row.state) ? (
                  <div className="col-span-2 mt-2 w-full sm:basis-full">
                    <ModelDownloadProgress model={row.model} />
                  </div>
                ) : null}
                {!row.model && activeStates.has(row.state) && row.detail ? (
                  <p className="col-span-2 w-full text-xs text-muted-foreground sm:basis-full">
                    {activitySummary(row.detail)}
                  </p>
                ) : null}
              </summary>
              <div className="mt-3 space-y-3">
                {!(row.model && activeStates.has(row.state)) ? (
                  <p className="text-sm text-muted-foreground">{activitySummary(row.detail)}</p>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link
                    to={`/infrastructure/${row.model ? 'models' : 'services'}?target=${encodeURIComponent(row.target)}`}
                  >
                    {row.model ? 'Open models' : 'Open services'}
                  </Link>
                </Button>
                {row.logs || (row.detail && row.detail.length > 320) ? (
                  <TechnicalDetails title="Technical details & logs">
                    {row.detail && row.detail.length > 320 ? (
                      <pre className="clio-scrollbar mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all bg-muted/40 p-3 text-xs">
                        {row.detail}
                      </pre>
                    ) : null}
                    {row.logs ? (
                      <pre className="clio-scrollbar max-h-72 overflow-auto whitespace-pre-wrap break-all bg-muted/40 p-3 text-xs">
                        {row.logs}
                      </pre>
                    ) : null}
                  </TechnicalDetails>
                ) : null}
              </div>
            </details>
          ))
        ) : (
          <div className="py-6 text-sm text-muted-foreground">
            <p>
              {search || filter !== 'all'
                ? 'No matching activity.'
                : 'No infrastructure operations yet.'}
            </p>
            {search || filter !== 'all' ? (
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/infrastructure/services">Set up a service</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/infrastructure/models">Download a model</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
