import type { InfrastructureInventory, McpUserConfiguration, RelayStatus } from '@clio/core/v3';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, BotIcon, CpuIcon, GlobeIcon, NetworkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRepository } from '@/hooks/use-repository';
import { useSavedServers } from '@/hooks/use-saved-servers';
import { useConnectionSettings } from '@/providers/connection-provider';
import { Button } from '@/components/ui/button';
import { ManagedServiceHostSelector } from './managed-service-host-selector';
import { ManagedServiceHostFacts } from './managed-service-host-facts';
import { displayHostPath } from '@/lib/host-path-display';
import { vocab } from '@/lib/brand-vocabulary';
import { InfrastructureTopology } from './infrastructure-topology';
import { remoteUrlFromSpec } from './web-search-configuration';

/** Read actual capabilities from the same inspection/cache used by Services. */
export function InfrastructureHostInspection({ targetId }: { targetId: string }) {
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const query = useQuery({
    queryKey: ['managed-service-catalog', settings.endpoint, targetId],
    queryFn: ({ signal }) => repository.managedServiceCatalog(targetId, signal),
    retry: false,
    staleTime: 30_000,
  });
  return (
    <section className="border-y py-4" aria-label="Computer capabilities">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Computer capabilities</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? 'Inspecting…' : 'Inspect again'}
        </Button>
      </div>
      {query.data ? (
        <>
          <ManagedServiceHostFacts facts={query.data.facts} />
          {query.data.facts.hostname ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Computer: {query.data.facts.hostname}
            </p>
          ) : null}
          {query.data.facts.home ? (
            <p className="mt-1 break-all text-xs text-muted-foreground">
              Home: {displayHostPath(query.data.facts.home)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {query.error
            ? `Could not inspect this computer: ${query.error.message}`
            : 'Reading this computer’s capabilities…'}
        </p>
      )}
    </section>
  );
}

/** A map first, clear routes to each role, and computer diagnostics on demand. */
export function InfrastructureOverview({
  data,
  targetId,
  onTarget,
  relay,
  webSearch,
  webSearchConnected = false,
  onManageRelay,
  onManageWebSearch,
}: {
  data: InfrastructureInventory;
  targetId: string;
  onTarget: (id: string) => void;
  relay?: RelayStatus;
  webSearch?: McpUserConfiguration;
  webSearchConnected?: boolean;
  onManageRelay?: () => void;
  onManageWebSearch?: () => void;
}) {
  const { settings } = useConnectionSettings();
  const { servers } = useSavedServers();
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const rows = [
    {
      label: 'Agent',
      icon: BotIcon,
      detail: settings.label || vocab.agent,
      description: 'Sessions and tools run here.',
      action: 'Inspect agent',
      to: '/infrastructure/agent',
    },
    {
      label: 'Inference',
      icon: CpuIcon,
      detail: servers.data?.length
        ? `${servers.data.length} saved model ${servers.data.length === 1 ? 'server' : 'servers'}`
        : 'Providers and model servers',
      description: 'Connect an API or a model server on any host.',
      action: 'Model providers',
      to: '/settings/providers',
    },
    {
      label: 'Relay',
      icon: NetworkIcon,
      detail: relay?.configured ? relay.host || relay.mcp_url || 'Configured' : 'Not connected',
      description: 'Execute work on another computer.',
      action: relay?.configured ? 'Manage Relay' : 'Connect Relay',
      onClick: onManageRelay,
      to: onManageRelay ? undefined : '/infrastructure/services',
    },
    {
      label: 'Web research',
      icon: GlobeIcon,
      detail: webSearchConnected
        ? remoteUrlFromSpec(webSearch?.spec) || 'Connected'
        : webSearch?.configured
          ? 'Needs attention'
          : 'Built-in search or a connected research service',
      description: 'Search and read sources for the local agent.',
      action: 'Research setup',
      onClick: onManageWebSearch,
      to: onManageWebSearch ? undefined : '/infrastructure/services',
    },
  ];
  return (
    <div className="mt-6 space-y-5">
      <InfrastructureTopology
        data={data}
        agentLabel={settings.label || vocab.agent}
        endpoint={settings.endpoint}
      />
      <section aria-label="Manage your setup">
        <p className="text-xs text-muted-foreground">
          Each service can use a different host. Your agent connection stays the same.
        </p>
        <div className="mt-3 divide-y border-y">
          {rows.map(({ label, icon: Icon, detail, description, action, to, onClick }) => (
            <div
              key={label}
              className="grid items-center gap-3 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
            >
              <div className="flex items-center gap-3 font-medium">
                <Icon className="size-4 text-primary" />
                {label}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm" title={detail}>
                  {detail}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </div>
              {to ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="w-fit justify-self-start sm:justify-self-end"
                >
                  <Link to={to}>
                    {action}
                    <ArrowRightIcon />
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit justify-self-start sm:justify-self-end"
                  onClick={onClick}
                >
                  {action}
                  <ArrowRightIcon />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>
      {servers.data?.length ? (
        <details className="border-b pb-4">
          <summary className="cursor-pointer text-sm font-medium">
            Saved model servers · {servers.data.length}
          </summary>
          <div className="mt-3 divide-y">
            {servers.data.map((server) => (
              <div key={server.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="font-medium">{server.label}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {server.address}
                </span>
                <span className="text-xs text-muted-foreground">
                  {server.check
                    ? server.check.reachable
                      ? 'Reachable'
                      : 'Not reachable'
                    : 'Not checked'}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {servers.error ? (
        <p role="alert" className="text-sm text-destructive">
          Saved model servers could not load: {servers.error.message}
        </p>
      ) : null}
      <details
        className="border-b pb-4"
        open={inspectionOpen}
        onToggle={(event) => setInspectionOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-medium">Computer details</summary>
        <section className="mt-4 space-y-3" aria-label="Computer inspection">
          <ManagedServiceHostSelector
            targets={data.targets}
            targetId={targetId}
            onSelect={onTarget}
          />
          {inspectionOpen ? <InfrastructureHostInspection targetId={targetId} /> : null}
        </section>
      </details>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to="/infrastructure/models">Download models & manage storage</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/infrastructure/activity">
            View activity
            <ArrowRightIcon />
          </Link>
        </Button>
      </div>
    </div>
  );
}
