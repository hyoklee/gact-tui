import type { InfrastructureInventory } from '@clio/core/v3';
import { ArrowDownIcon, LaptopIcon, ServerIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { vocab } from '@/lib/brand-vocabulary';

/** Product names for the installed services exposed in the inventory. */
function infrastructureServiceName(id: string): string {
  const names: Record<string, string> = {
    searxng: 'SearXNG',
    web_search: `${vocab.agent} Web Search`,
    relay: `${vocab.agent} Relay`,
    vllm: 'vLLM',
    llama_cpp: 'llama.cpp',
    ollama: 'Ollama',
    flowcept: 'Flowcept',
    cmf: 'HPE CMF',
  };
  return names[id] ?? id.replaceAll('_', ' ');
}

/** Management edges connect real computers, without claiming their services are selected. */
export function InfrastructureTopology({
  data,
  agentLabel,
  endpoint,
}: {
  data: InfrastructureInventory;
  agentLabel: string;
  endpoint: string;
}) {
  const remote = data.targets.filter((target) => target.kind !== 'local');
  const local = data.targets.find((target) => target.kind === 'local');
  const height = Math.max(260, remote.length * 130);
  const hostServices = (targetId: string) =>
    data.services.filter((row) => row.target_id === targetId);
  const servicesOn = (id: string) => (
    <div className="mt-3 space-y-1.5 text-xs">
      {hostServices(id).map((service) => (
        <div key={service.id} className="flex items-center justify-between gap-3">
          <span>{infrastructureServiceName(service.service_id)}</span>
          <span className="text-muted-foreground">
            {service.state === 'running'
              ? 'Running'
              : service.state === 'stopped'
                ? 'Stopped'
                : 'Not checked'}
          </span>
        </div>
      ))}
    </div>
  );
  return (
    <section aria-label="Connection map" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Your setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a computer to manage its services.
        </p>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-muted/40 p-5 sm:p-8">
        <div
          className="relative grid items-center gap-5 md:grid-cols-[0.7fr_1fr_1fr] md:gap-8"
          style={{ minHeight: height }}
        >
          <svg
            role="img"
            aria-label="Connections from this client to the agent and managed computers"
            className="pointer-events-none absolute inset-0 hidden h-full w-full text-primary/40 md:block"
            viewBox={`0 0 800 ${height}`}
            preserveAspectRatio="none"
          >
            <path d={`M100 ${height / 2} H380`} fill="none" stroke="currentColor" strokeWidth="2" />
            {remote.map((host, index) => (
              <path
                key={host.id}
                d={`M380 ${height / 2} H540 V${((index + 0.5) * height) / remote.length} H700`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={host.transport_state === 'connected' ? undefined : '5 5'}
              />
            ))}
          </svg>
          <div className="relative mx-auto text-center">
            <LaptopIcon className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">This client</p>
            <p className="mt-1 text-xs text-muted-foreground">Desktop or browser</p>
          </div>
          <ArrowDownIcon className="mx-auto size-4 text-primary/60 md:hidden" aria-hidden="true" />
          <Link
            to="/infrastructure/agent"
            aria-label={`Inspect connected ${vocab.agent}`}
            className="relative rounded-xl border border-primary/40 bg-background p-5 shadow-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="flex items-center gap-2 text-primary">
              <ServerIcon className="size-4" />
              <span className="text-xs font-medium">Connected {vocab.agent}</span>
            </div>
            <p className="mt-2 font-semibold">{agentLabel}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={endpoint}>
              {endpoint}
            </p>
            {servicesOn(local?.id ?? 'local')}
          </Link>
          <div className="relative grid gap-3">
            {remote.map((host) => (
              <Link
                key={host.id}
                to={`/infrastructure/services?target=${encodeURIComponent(host.id)}`}
                className="rounded-xl border bg-background p-4 shadow-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="flex items-center gap-2">
                  <ServerIcon className="size-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 truncate font-medium">{host.label}</p>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{host.kind === 'ssh' ? 'SSH' : 'Endpoint'}</span>
                  <Badge variant="outline">{host.transport_state.replaceAll('_', ' ')}</Badge>
                </div>
                {servicesOn(host.id)}
              </Link>
            ))}
            {!remote.length ? (
              <p className="relative bg-muted/80 p-3 text-sm text-muted-foreground">
                No remote computers added.
                <br />
                <Link
                  to="/infrastructure/services"
                  className="mt-2 inline-block text-primary underline-offset-4 hover:underline"
                >
                  Add a service host
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Lines show management connections. Installed services and selected connections are separate.
      </p>
    </section>
  );
}
