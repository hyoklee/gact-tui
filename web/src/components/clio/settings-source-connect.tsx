import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { SourceProvider } from '@clio/core/v3';
import { useRepository } from '@/hooks/use-repository';
import { useConnectionSettings } from '@/providers/connection-provider';
import { connectionScope } from '@/lib/connection-scope';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { newConversationRoute } from '@/lib/workspace-route-memory';
import type { ObsidianChoice } from './obsidian-source-form';

/** Settings actions explicitly choose a workspace before opening its shared source form. */
export function SettingsSourceConnect({
  provider,
  choice,
  onClose,
}: {
  provider: SourceProvider;
  choice?: ObsidianChoice;
  onClose: () => void;
}) {
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const scope = connectionScope(settings);
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState('');
  const workspaces = useQuery({
    queryKey: ['source-settings-workspaces', scope],
    queryFn: ({ signal }) => repository.workspaces(signal),
    retry: false,
  });
  const selected =
    workspaces.data?.find((row) => row.id === workspaceId) ??
    (workspaces.data?.length === 1 ? workspaces.data[0] : undefined);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{choice === 'new' ? 'New vault' : `Connect ${provider.name}`}</DialogTitle>
          <DialogDescription>
            Choose the workspace for this source. Review the connection and access in the next step.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="source-workspace">Workspace</FieldLabel>
          <select
            id="source-workspace"
            className="w-full rounded-md border bg-background p-2"
            value={selected?.id ?? ''}
            onChange={(event) => setWorkspaceId(event.target.value)}
          >
            <option value="">
              {workspaces.isPending ? 'Loading workspaces…' : 'Choose a workspace'}
            </option>
            {workspaces.data?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.display_name}
              </option>
            ))}
          </select>
        </Field>
        {workspaces.error ? (
          <p role="alert" className="text-sm text-destructive">
            {workspaces.error.message}
          </p>
        ) : null}
        {workspaces.isSuccess && !workspaces.data.length ? (
          <p className="text-sm text-muted-foreground">
            Create a workspace first, then connect its data here.
          </p>
        ) : null}
        <Button
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            void navigate(newConversationRoute(selected.id), {
              state: { sourceConnection: { scope, providerId: provider.id, choice } },
            });
          }}
        >
          Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
}
