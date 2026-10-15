import type { InfrastructureInventory } from '@clio/core/v3';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDownIcon, LaptopIcon, ServerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { vocab } from '@/lib/brand-vocabulary';
import { InfrastructureHostInspection } from './infrastructure-overview';

/** The same computer row and direct actions for local and remote computers. */
export function InfrastructureHosts({
  data,
  children,
}: {
  data: InfrastructureInventory;
  children?: ReactNode;
}) {
  return (
    <div className="mt-6 divide-y border-y">
      {data.targets
        .filter((host) => host.kind !== 'direct')
        .map((host) => (
          <ComputerRow
            key={host.id}
            label={host.kind === 'local' ? 'Local' : host.label}
            id={host.id}
            local={host.kind === 'local'}
            address={
              host.ssh?.host ||
              (host.kind === 'local' ? `Connected ${vocab.agent}` : 'Saved computer')
            }
            status={host.kind === 'local' ? 'Connected' : host.transport_state.replaceAll('_', ' ')}
          >
            {host.kind === 'local' ? children : <InfrastructureHostInspection targetId={host.id} />}
          </ComputerRow>
        ))}
    </div>
  );
}

function ComputerRow({
  id,
  label,
  local,
  address,
  status,
  children,
}: {
  id: string;
  label: string;
  local: boolean;
  address: string;
  status: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Icon = local ? LaptopIcon : ServerIcon;
  return (
    <section className="py-4" aria-label={`${label} computer`}>
      <div className="flex flex-wrap items-center gap-3">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{label}</h2>
          <p className="truncate text-xs text-muted-foreground">{address}</p>
        </div>
        <Badge
          variant="outline"
          title="Connection to this computer. Services have their own run and connection states."
        >
          {status}
        </Badge>
        <Button asChild size="sm" variant="outline">
          <Link to={`/infrastructure/services?target=${encodeURIComponent(id)}`}>Services</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link to={`/infrastructure/models?target=${encodeURIComponent(id)}`}>Models</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-label={`${label} details`}
          onClick={() => setOpen(!open)}
        >
          Details <ChevronDownIcon className={open ? 'rotate-180' : ''} />
        </Button>
      </div>
      {open ? <div className="mt-4 border-t pt-4">{children}</div> : null}
    </section>
  );
}
