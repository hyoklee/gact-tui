import { vocab } from '@/lib/brand-vocabulary';
import type { Session } from '@clio/core/v3';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, SendIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRepository } from '@/hooks/use-repository';
import { useLiveSessionTranscript } from '@/hooks/use-live-session-transcript';
import { useConnectionSettings } from '@/providers/connection-provider';
import { connectionScope } from '@/lib/connection-scope';
import { isSessionActive } from '@/lib/session-state';
import type { ClioWorkbenchOpenRequest } from './workbench';
import { ClioConversation } from './conversation';

/** An isolated real CLIO session: Tab selects the mode; Enter starts inference. */
export function ClioSearchAssistant({
  workspaceId,
  parentSessionId,
  query,
  onQueryChange,
  onBack,
  onClose,
  onOpenResource,
}: {
  workspaceId: string;
  parentSessionId?: string;
  query: string;
  onQueryChange: (query: string) => void;
  onBack: () => void;
  onClose: () => void;
  onOpenResource?: (request: ClioWorkbenchOpenRequest) => void;
}) {
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const [session, setSession] = useState<Session>();
  const held = useRef<Session | undefined>(undefined);
  const alive = useRef(true);
  const sending = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const { entities, messages, transcript } = useLiveSessionTranscript(
    session?.workspace_id ?? workspaceId,
    session?.id,
    'search',
  );
  const fleet = useQuery({
    queryKey: ['fleet-settings', settings.endpoint, connectionScope(settings)],
    queryFn: ({ signal }) => repository.fleetSettings(signal),
  });
  const active = Boolean(
    session && isSessionActive(entities.sessions[session.id]?.state ?? session.state),
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const previous = held.current;
      held.current = undefined;
      if (previous)
        void repository.deleteSession(previous.id).catch((reason: unknown) =>
          toast.error(`${vocab.agent} Search could not be closed`, {
            description: reason instanceof Error ? reason.message : 'The service rejected it.',
          }),
        );
    };
  }, [repository]);

  const ask = async () => {
    const text = query.trim();
    if (!text || sending.current || active) return;
    sending.current = true;
    setSubmitting(true);
    setError(undefined);
    try {
      const current =
        held.current ??
        (await repository.openSearchSession({
          workspace_id: workspaceId,
          ...(parentSessionId ? { parent_session_id: parentSessionId } : {}),
        }));
      if (!alive.current) {
        await repository.deleteSession(current.id);
        return;
      }
      held.current = current;
      setSession(current);
      const id = `search-${crypto.randomUUID()}`;
      await repository.submitMessage(current.id, {
        client_message_id: id,
        idempotency_key: id,
        behavior: { execution_mode: 'execute', confirmation_policy: 'ask' },
        delivery: 'start',
        parts: [{ type: 'text', text }],
      });
      onQueryChange('');
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'The connected service could not start the search assistant.',
        );
    } finally {
      sending.current = false;
      if (alive.current) setSubmitting(false);
    }
  };
  return (
    <div className="flex min-h-0 flex-col" data-slot="search-assistant">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button size="icon-sm" variant="ghost" aria-label="Back to search results" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <SparklesIcon aria-hidden="true" className="size-4 text-blue-500" />
        <span className="text-sm font-semibold">{vocab.agent} Search</span>
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {session?.model_id ?? fleet.data?.search?.model_id ?? 'Conversation or service model'}
        </span>
        <Link className="text-xs text-primary" to="/settings/fleet" onClick={onClose}>
          Fleet
        </Link>
      </div>
      <form
        className="flex gap-2 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
      >
        <Input
          autoFocus
          aria-label={`Ask ${vocab.agent} Search`}
          placeholder="Ask about conversations, messages, and files…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <Button
          type="submit"
          aria-label={`Search with ${vocab.agent}`}
          disabled={!query.trim() || submitting || active}
        >
          <SendIcon className="size-4" />
        </Button>
      </form>
      <p className="px-3 pb-2 text-xs text-muted-foreground">
        Read-only search across this connected service’s workspaces.
      </p>
      {error ? (
        <p role="alert" className="mx-3 mb-3 rounded-md border border-destructive p-3 text-sm">
          {error}
        </p>
      ) : null}
      {session ? (
        <div
          className="h-[48dvh] min-h-48 border-t"
          onClick={(event) => {
            const link = (event.target as HTMLElement).closest('a');
            if (link?.getAttribute('href')?.startsWith('/workspaces/')) onClose();
          }}
        >
          <ClioConversation
            sessionId={session.id}
            workspaceId={session.workspace_id}
            messages={messages}
            tools={entities.tools}
            tasks={entities.tasks}
            subagents={entities.subagents}
            artifacts={entities.artifacts}
            surfaces={entities.surfaces}
            loading={transcript.isPending}
            error={transcript.error?.message}
            onOpenFileReference={(path, location) => {
              onOpenResource?.({
                kind: 'workspace-file',
                ...location,
                workspaceId: location.workspaceId ?? session.workspace_id,
                path,
              });
              onClose();
            }}
          />
        </div>
      ) : (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
          Find a previous decision, locate a passage, or ask what your files say.
          <br />
          Press Enter to search with your Fleet model.
        </div>
      )}
      {submitting || active ? (
        <p role="status" className="px-3 pb-3 text-xs text-muted-foreground">
          Searching…
        </p>
      ) : null}
    </div>
  );
}
