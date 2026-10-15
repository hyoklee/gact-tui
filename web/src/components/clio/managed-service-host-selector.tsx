import type { InfrastructureTarget } from '@clio/core/v3';
import { ArrowLeftIcon, CheckIcon, LaptopIcon, ServerIcon } from 'lucide-react';
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

/** One host chooser; editing an SSH route never changes the agent connection. */
export function ManagedServiceHostSelector({
  targets,
  targetId,
  canAdd,
  sshHost,
  onSelect,
  onSshHost,
  pending,
  error,
}: {
  targets: InfrastructureTarget[];
  targetId: string;
  canAdd: boolean;
  sshHost?: SshHost;
  onSelect: (id: string) => void;
  onSshHost: (host: SshHost) => Promise<unknown>;
  pending: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setEditing(false);
          setOpen(true);
        }}
      >
        Change host
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Connect a computer' : 'Choose a service host'}</DialogTitle>
          <DialogDescription>
            Choose where to manage services. Your {vocab.agent} connection stays the same.
          </DialogDescription>
        </DialogHeader>
        {editing ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <ArrowLeftIcon /> Saved computers
            </Button>
            <SshHostPicker
              disabled={pending}
              value={sshHost}
              onChange={(host, route) => {
                if (!host || route.emptyRows.length) return;
                void onSshHost(host).then(
                  () => setOpen(false),
                  () => undefined,
                );
              }}
            />
            {pending ? <p role="status">Connecting…</p> : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="divide-y">
            {(targets.length
              ? targets
              : [{ id: 'local', label: `This ${vocab.agent}’s computer`, kind: 'local' }]
            )
              .filter((host) => host.kind !== 'direct')
              .map((host) => {
                const Icon = host.kind === 'local' ? LaptopIcon : ServerIcon;
                return (
                  <button
                    key={host.id}
                    aria-label={`Manage services on ${host.label}`}
                    aria-pressed={host.id === targetId}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-4 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => {
                      onSelect(host.id);
                      setOpen(false);
                    }}
                  >
                    <Icon className="size-5 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{host.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {host.kind === 'local' ? 'Agent’s computer' : 'Saved SSH computer'}
                      </span>
                    </span>
                    {host.id === targetId ? <CheckIcon className="size-4 text-primary" /> : null}
                  </button>
                );
              })}
            {canAdd ? (
              <Button
                variant="ghost"
                className="mt-2 w-full justify-start"
                onClick={() => setEditing(true)}
              >
                <AddIcon /> Add another computer
              </Button>
            ) : null}
            {canAdd && sshHost ? (
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setEditing(true)}
              >
                Edit SSH route
              </Button>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
