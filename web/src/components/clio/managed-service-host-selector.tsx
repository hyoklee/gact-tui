import type { InfrastructureTarget } from '@clio/core/v3';
import { CheckIcon, LaptopIcon, ServerIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SshHost } from '@/lib/ssh-hosts';
import { AddIcon } from '@/lib/icon-vocabulary';
import { vocab } from '@/lib/brand-vocabulary';
import { SshHostPicker } from './ssh-host-picker';

/** Saved computers switch in one click; only connection editing opens a dialog. */
export function ManagedServiceHostSelector({
  targets,
  targetId,
  canAdd = false,
  sshHost,
  onSelect,
  onSshHost,
  pending = false,
  error,
}: {
  targets: InfrastructureTarget[];
  targetId: string;
  canAdd?: boolean;
  sshHost?: SshHost;
  onSelect: (id: string) => void;
  onSshHost?: (host: SshHost) => Promise<unknown>;
  pending?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const computers = targets.length
    ? targets.filter((host) => host.kind !== 'direct')
    : [{ id: 'local', label: `This ${vocab.agent}'s computer`, kind: 'local' }];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-2" aria-label="Choose a computer">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Computer</span>
        {computers.map((host) => {
          const Icon = host.kind === 'local' ? LaptopIcon : ServerIcon;
          return (
            <Button
              key={host.id}
              size="sm"
              variant={host.id === targetId ? 'secondary' : 'ghost'}
              aria-label={`Select ${host.kind === 'local' ? 'Local' : host.label} computer`}
              aria-pressed={host.id === targetId}
              onClick={() => onSelect(host.id)}
            >
              <Icon aria-hidden="true" />
              {host.kind === 'local' ? 'Local' : host.label}
              {host.id === targetId ? <CheckIcon aria-hidden="true" className="size-3.5" /> : null}
            </Button>
          );
        })}
        {canAdd && onSshHost ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <AddIcon /> Add computer
            </Button>
            {sshHost ? (
              <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                Edit connection
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {canAdd && onSshHost ? (
        <ComputerConnectionContent
          sshHost={sshHost}
          pending={pending}
          error={error}
          onConnect={onSshHost}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Dialog>
  );
}

/** The same saved-host picker and error recovery for Hosts, Services and Models. */
export function ComputerConnectionContent({
  sshHost,
  pending,
  error,
  onConnect,
  onClose,
}: {
  sshHost?: SshHost;
  pending: boolean;
  error?: string;
  onConnect: (host: SshHost) => Promise<unknown>;
  onClose: () => void;
}) {
  const [candidate, setCandidate] = useState(sshHost);
  const connect = (host: SshHost) => {
    setCandidate(host);
    void onConnect(host).then(onClose, () => undefined);
  };
  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Connect a computer</DialogTitle>
        <DialogDescription>
          Choose where to run services. Your {vocab.agent} stays connected.
        </DialogDescription>
      </DialogHeader>
      <SshHostPicker
        disabled={pending}
        value={sshHost}
        onChange={(host, route) => {
          if (!host || route.emptyRows.length) return;
          connect(host);
        }}
      />
      {pending ? <p role="status">Connecting...</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        {error && candidate ? (
          <Button disabled={pending} onClick={() => connect(candidate)}>
            Retry connection
          </Button>
        ) : null}
        <Button className="w-fit" variant="ghost" onClick={onClose}>
          {pending ? 'Close' : 'Cancel'}
        </Button>
      </div>
    </DialogContent>
  );
}
