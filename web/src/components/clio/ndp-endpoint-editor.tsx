import { useState } from 'react';
import type { NDPEndpointInput } from '@clio/core/v3';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    authentication: initial?.authentication ?? 'none',
  });
  const [transport, setTransport] = useState(initial?.ssh_profile ? 'ssh' : 'url');
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...choice, ssh_profile: transport === 'ssh' ? choice.ssh_profile : '' });
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
        <div className="space-y-1">
          <Label htmlFor="ndp-endpoint-ssh">SSH profile on connected computer</Label>
          <Input
            id="ndp-endpoint-ssh"
            required
            value={choice.ssh_profile}
            placeholder="ares"
            onChange={(event) => setChoice({ ...choice, ssh_profile: event.target.value })}
          />
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
        <Label htmlFor="ndp-endpoint-auth">Authentication</Label>
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
          <option value="none">Public access</option>
          <option value="ndp">My NDP account</option>
        </select>
      </div>
      {choice.authentication === 'ndp' ? (
        <p className="text-xs text-muted-foreground">
          Use your saved NDP sign-in for this API. Its own access permissions still apply.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button disabled={pending}>
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
