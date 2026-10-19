import { useState } from 'react';
import type { NDPEndpointInput } from '@clio/core/v3';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConnectedSshHostPicker } from './connected-ssh-host-picker';
import { sshRouteHost } from '@/lib/ssh-hosts';
import { sshTargetDefinition } from './managed-service-target-utils';
import { routeIncompleteMessage } from './ssh-route-utils';

/** Review the actual API route and account destination before saving a connection. */
export function NDPEndpointEditor({
  initial,
  pending,
  error,
  onSave,
  onCancel,
  onAuthentication,
}: {
  initial?: NDPEndpointInput;
  pending: boolean;
  error?: Error | null;
  onSave: (input: NDPEndpointInput) => void;
  onCancel: () => void;
  onAuthentication: (authentication: NDPEndpointInput['authentication']) => void;
}) {
  const [choice, setChoice] = useState<NDPEndpointInput>({
    name: initial?.name ?? '',
    url: initial?.url ?? '',
    ssh_profile: initial?.ssh_profile ?? '',
    ssh_route: initial?.ssh_route,
    authentication: initial?.authentication ?? 'none',
  });
  const [transport, setTransport] = useState(
    initial?.ssh_profile || initial?.ssh_route ? 'ssh' : 'url',
  );
  const [host, setHost] = useState(() =>
    initial?.ssh_route
      ? sshRouteHost(initial.ssh_route)
      : initial?.ssh_profile
        ? sshRouteHost({ profile: initial.ssh_profile })
        : undefined,
  );
  const [routeError, setRouteError] = useState<string>();
  const [routeChanged, setRouteChanged] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (transport === 'ssh' && (!host || routeError)) return;
        onSave({
          ...choice,
          ssh_profile: transport === 'ssh' && !routeChanged ? (initial?.ssh_profile ?? '') : '',
          ssh_route:
            transport === 'ssh' && host && (routeChanged || !initial?.ssh_profile)
              ? (sshTargetDefinition(host).ssh as NonNullable<NDPEndpointInput['ssh_route']>)
              : null,
        });
      }}
    >
      <div className="flex gap-2" aria-label="Endpoint connection method">
        {(['url', 'ssh'] as const).map((route) => (
          <Button
            key={route}
            type="button"
            variant={transport === route ? 'secondary' : 'ghost'}
            onClick={() => setTransport(route)}
          >
            {route === 'url' ? 'Direct URL' : 'SSH'}
          </Button>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="ndp-endpoint-name">Name</Label>
        <Input
          id="ndp-endpoint-name"
          required
          value={choice.name}
          placeholder="Ares NDP"
          onChange={(event) => setChoice({ ...choice, name: event.target.value })}
        />
      </div>
      {transport === 'ssh' ? (
        <div className="space-y-2">
          <Label>SSH connection route</Label>
          <ConnectedSshHostPicker
            value={host}
            disabled={pending}
            onChange={(next, completeness) => {
              setHost(next);
              setRouteChanged(true);
              setRouteError(routeIncompleteMessage(completeness));
            }}
          />
          {routeError ? (
            <p role="alert" className="text-sm text-destructive">
              {routeError}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="ndp-endpoint-url">
          {transport === 'ssh' ? 'Remote API URL' : 'API URL'}
        </Label>
        <Input
          id="ndp-endpoint-url"
          type="url"
          required
          value={choice.url}
          placeholder={transport === 'ssh' ? 'http://127.0.0.1:8002' : 'https://host/ep-api'}
          onChange={(event) => setChoice({ ...choice, url: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ndp-endpoint-auth">API sign-in</Label>
        <select
          id="ndp-endpoint-auth"
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          value={choice.authentication}
          onChange={(event) => {
            const authentication = event.target.value as 'none' | 'ndp';
            setChoice({ ...choice, authentication });
            onAuthentication(authentication);
          }}
        >
          <option value="none">No NDP sign-in</option>
          <option value="ndp">Use my NDP sign-in</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        {choice.authentication === 'ndp'
          ? 'Send your saved NDP account token to this API. The Endpoint must accept your account and grant access.'
          : 'No NDP account token is sent. Only operations available without NDP sign-in can be used.'}
        {transport === 'ssh' ? (
          <span className="block">Your SSH connection is authenticated separately.</span>
        ) : null}
      </p>
      <div className="flex gap-2">
        <Button disabled={pending || (transport === 'ssh' && (!host || Boolean(routeError)))}>
          {pending ? 'Checking API…' : initial ? 'Save endpoint' : 'Connect'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
    </form>
  );
}
