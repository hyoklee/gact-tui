import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NDPEndpointConnection, NDPEndpointInput } from '@clio/core/v3';
import { ArrowLeftIcon } from 'lucide-react';
import { AddIcon } from '@/lib/icon-vocabulary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useRepository } from '@/hooks/use-repository';
import { useConnectionSettings } from '@/providers/connection-provider';
import { connectionScope } from '@/lib/connection-scope';
import { NDPEndpointOperationView } from './ndp-endpoint-operation';
import { ConnectedAccountSignIn } from './connected-source-auth';

/** Connect to a running remote API and operate it through the connected CLIO. */
export function NDPEndpointPanel({
  workspaceId,
  onBack,
  signedIn = false,
}: {
  workspaceId: string;
  onBack: () => void;
  signedIn?: boolean;
}) {
  const repository = useRepository();
  const client = useQueryClient();
  const { settings } = useConnectionSettings();
  const key = ['ndp-endpoints', connectionScope(settings), workspaceId];
  const endpoints = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => repository.ndpEndpointConnections(workspaceId, signal),
  });
  const [selected, setSelected] = useState<string>('');
  const [accountReady, setAccountReady] = useState(false);
  const [adding, setAdding] = useState(false);
  const [transport, setTransport] = useState('url');
  const [choice, setChoice] = useState<NDPEndpointInput>({
    name: '',
    url: '',
    ssh_profile: '',
    authentication: 'none',
  });
  const connect = useMutation({
    mutationFn: () =>
      repository.connectNdpEndpoint(workspaceId, {
        ...choice,
        ssh_profile: transport === 'ssh' ? choice.ssh_profile : '',
      }),
    onSuccess: (endpoint) => {
      client.setQueryData(key, (old: { endpoints: NDPEndpointConnection[] } | undefined) => ({
        endpoints: [...(old?.endpoints ?? []).filter((row) => row.id !== endpoint.id), endpoint],
      }));
      setSelected(endpoint.id);
      setAdding(false);
    },
  });
  const active =
    endpoints.data?.endpoints.find((row) => row.id === selected) ?? endpoints.data?.endpoints[0];
  return (
    <section aria-label="NDP endpoints" className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeftIcon /> Back
      </Button>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">Endpoints & streams</h3>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <AddIcon /> Connect endpoint
        </Button>
      </div>
      {endpoints.isPending ? <Skeleton className="h-10 w-full" /> : null}
      {endpoints.error ? (
        <p role="alert" className="text-sm text-destructive">
          {endpoints.error.message}
        </p>
      ) : null}
      {!signedIn &&
      !accountReady &&
      (active?.authentication === 'ndp' || choice.authentication === 'ndp') ? (
        <ConnectedAccountSignIn
          provider="ndp"
          onComplete={() => {
            setAccountReady(true);
            void client.invalidateQueries({
              queryKey: ['connected-storage', connectionScope(settings)],
            });
          }}
        />
      ) : null}
      {adding || (!active && !endpoints.isPending) ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            connect.mutate();
          }}
        >
          <div className="flex gap-2" aria-label="Endpoint connection method">
            <Button
              type="button"
              variant={transport === 'url' ? 'secondary' : 'ghost'}
              onClick={() => setTransport('url')}
            >
              Direct URL
            </Button>
            <Button
              type="button"
              variant={transport === 'ssh' ? 'secondary' : 'ghost'}
              onClick={() => setTransport('ssh')}
            >
              SSH
            </Button>
          </div>
          <Label htmlFor="ndp-endpoint-name">Name</Label>
          <Input
            id="ndp-endpoint-name"
            required
            value={choice.name}
            onChange={(event) => setChoice({ ...choice, name: event.target.value })}
            placeholder="Ares NDP"
          />
          {transport === 'ssh' ? (
            <>
              <Label htmlFor="ndp-endpoint-ssh">SSH profile on connected computer</Label>
              <Input
                id="ndp-endpoint-ssh"
                required
                value={choice.ssh_profile}
                placeholder="ares"
                onChange={(event) => setChoice({ ...choice, ssh_profile: event.target.value })}
              />
            </>
          ) : null}
          <Label htmlFor="ndp-endpoint-url">
            {transport === 'ssh' ? 'Remote API URL' : 'API URL'}
          </Label>
          <Input
            id="ndp-endpoint-url"
            type="url"
            required
            value={choice.url}
            placeholder={transport === 'ssh' ? 'http://127.0.0.1:8002' : 'https://host/gnss'}
            onChange={(event) => setChoice({ ...choice, url: event.target.value })}
          />
          <Label htmlFor="ndp-endpoint-auth">Authentication</Label>
          <select
            id="ndp-endpoint-auth"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={choice.authentication}
            onChange={(event) =>
              setChoice({ ...choice, authentication: event.target.value as 'none' | 'ndp' })
            }
          >
            <option value="none">Public access</option>
            <option value="ndp">My NDP account</option>
          </select>
          {choice.authentication === 'ndp' ? (
            <p className="text-xs text-muted-foreground">
              Your NDP token will be sent to this API through the selected connection.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button disabled={connect.isPending}>
              {connect.isPending ? 'Discovering operations…' : 'Connect'}
            </Button>
            {active ? (
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            ) : null}
          </div>
          {connect.error ? (
            <p role="alert" className="text-sm text-destructive">
              {connect.error.message}
            </p>
          ) : null}
        </form>
      ) : active ? (
        <>
          <select
            aria-label="Connected endpoint"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={active.id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {endpoints.data?.endpoints.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.ssh_profile ? ` · SSH ${row.ssh_profile}` : ''}
              </option>
            ))}
          </select>
          <NDPEndpointOperationView
            key={active.id}
            workspaceId={workspaceId}
            endpoint={active}
            onChanged={() => void client.invalidateQueries({ queryKey: key })}
          />
        </>
      ) : null}
    </section>
  );
}
