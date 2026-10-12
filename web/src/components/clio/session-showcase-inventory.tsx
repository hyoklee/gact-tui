import { useQuery } from '@tanstack/react-query';
import type { ConnectedSourceState } from '@clio/core/v3';
import { CalendarClockIcon, DatabaseIcon, ListChecksIcon } from 'lucide-react';
import { Accordion } from '@/components/ui/accordion';
import { useRepository } from '@/hooks/use-repository';
import { useConnectionSettings } from '@/providers/connection-provider';
import { connectionScope } from '@/lib/connection-scope';
import { useEvidenceSections } from '@/hooks/use-evidence-disclosures';
import { TodoList, TodoStatusIcon } from './todo-list';
import { todoCurrentSummary } from './todo-list-summary';
import { EvidenceSection } from './observability-evidence-section';
import { useSessionWork } from './use-session-work';
import { SessionSummaryRow } from './session-summary-row';

/** Connected data belongs beside context and artifacts, independently of work state. */
export function SessionConnectedSources({
  workspaceId,
  onOpenSource,
}: {
  workspaceId: string;
  onOpenSource?: (source: ConnectedSourceState) => void;
}) {
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const sources = useQuery({
    queryKey: ['connected-storage', connectionScope(settings), workspaceId, 'sources'],
    queryFn: ({ signal }) => repository.connectedSources(workspaceId, signal),
    refetchInterval: 5000,
  });
  const connected = sources.data?.filter((source) => source.connected) ?? [];
  const sections = useEvidenceSections('evidence-connected', ['connected']);
  if (sources.error)
    return (
      <p role="alert" className="py-2 text-xs">
        Connected sources could not be loaded.
      </p>
    );
  if (!connected.length) return null;
  return (
    <Accordion type="multiple" {...sections}>
      <EvidenceSection
        compact
        icon={DatabaseIcon}
        label="Connected sources"
        value="connected"
        count={connected.length}
      >
        {connected.map((source) => (
          <SessionSummaryRow
            key={source.id}
            icon={<DatabaseIcon />}
            label={source.label}
            onOpen={onOpenSource ? () => onOpenSource(source) : undefined}
          />
        ))}
      </EvidenceSection>
    </Accordion>
  );
}

/** Show current todos and scheduled instructions using their existing query owners. */
export function SessionWorkShowcase({
  sessionId,
  onOpenWork,
}: {
  sessionId: string;
  onOpenWork?: () => void;
}) {
  const work = useSessionWork(sessionId);
  const repository = useRepository();
  const { settings } = useConnectionSettings();
  const schedules = useQuery({
    queryKey: ['session-work-schedules', settings.endpoint, sessionId],
    queryFn: ({ signal }) => repository.scheduledTurns(sessionId, signal),
    refetchInterval: 5000,
  });
  const todos = work.data?.todos ?? [];
  const scheduled = schedules.data?.schedules ?? [];
  const sections = useEvidenceSections('evidence-work', ['todos', 'schedules']);
  return (
    <>
      {work.error ? (
        <p role="alert" className="py-2 text-xs">
          Session work could not be loaded.
        </p>
      ) : null}
      {schedules.error ? (
        <p role="alert" className="py-2 text-xs">
          Schedules could not be loaded.
        </p>
      ) : null}
      <Accordion type="multiple" {...sections}>
        {todos.length ? (
          <EvidenceSection
            compact
            icon={ListChecksIcon}
            label="Todos"
            value="todos"
            count={todos.length}
            summary={todoCurrentSummary(todos, (todo) => todo.status)}
          >
            <TodoList
              items={todos}
              status={(todo) => todo.status}
              scope="showcase"
              renderItem={(todo, index) => (
                <li key={`${index}:${todo.content}`}>
                  <SessionSummaryRow
                    icon={<TodoStatusIcon state={todo.status} />}
                    label={todo.content}
                    metadata={
                      todo.status === 'in_progress'
                        ? 'In progress'
                        : todo.status === 'completed'
                          ? 'Completed'
                          : 'Pending'
                    }
                    onOpen={onOpenWork}
                  />
                </li>
              )}
            />
          </EvidenceSection>
        ) : null}
        {scheduled.length ? (
          <EvidenceSection
            compact
            icon={CalendarClockIcon}
            label="Schedules"
            value="schedules"
            count={scheduled.length}
          >
            {scheduled.map((schedule) => (
              <SessionSummaryRow
                key={schedule.id}
                icon={<CalendarClockIcon />}
                label={schedule.question}
                metadata={schedule.enabled ? 'Scheduled' : 'Paused'}
                title={[
                  schedule.question,
                  schedule.next_fire_at
                    ? `Next run: ${new Date(schedule.next_fire_at).toLocaleString()}`
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(' — ')}
                onOpen={onOpenWork}
              />
            ))}
          </EvidenceSection>
        ) : null}
      </Accordion>
    </>
  );
}
