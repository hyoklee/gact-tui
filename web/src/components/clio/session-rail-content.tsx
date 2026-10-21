import type { ConnectedSourceState } from '@clio/core/v3';
import { CalendarClockIcon, DatabaseIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { artifactDeliverables } from '@/lib/artifact-presentation';
import { openHumanQuestions } from '@/lib/inline-question';
import type { ClioObservabilityDockProps } from './observability-dock-shell';
import { ClioContextMeter } from './context-meter';
import { contextTokens } from './context-composition-model';
import { sessionEvidenceItems } from './session-evidence-items';
import { sessionFiles, sessionDiffs, sessionPlans } from './session-evidence-projection';
import { sessionSources } from './observability-evidence-sources';
import { OpenQuestionList } from './open-question-list';
import { useQuestionAnswer } from './question-answer-context';
import { SessionRail } from './session-rail';
import type { SessionRailItem } from './session-rail-layout';
import { SessionSummaryRow } from './session-summary-row';
import { useSessionConnectedSources, useSessionSchedules } from './session-inventory-queries';
import { useSessionWork } from './use-session-work';
import { SessionWorkSummary } from './session-work';
import { TodoList, TodoStatusIcon } from './todo-list';
import { todoCurrentSummary } from './todo-list-summary';
import type { ReactNode } from 'react';

/** Assemble the rail from the same projections, query keys and navigation as full details. */
export function SessionRailContent({
  evidence,
  onOpenSource,
  actions,
}: {
  evidence: ClioObservabilityDockProps;
  onOpenSource: (source: ConnectedSourceState) => void;
  actions?: ReactNode;
}) {
  const connected = useSessionConnectedSources(evidence.workspaceId ?? '');
  const work = useSessionWork(evidence.sessionId ?? '');
  const schedules = useSessionSchedules(evidence.sessionId ?? '');
  const answer = useQuestionAnswer();
  const questions = openHumanQuestions(evidence.interactions ?? answer?.interactions ?? []);
  const todos = work.data?.todos ?? [];
  const scheduled = schedules.data?.schedules ?? [];
  const sources = connected.data?.filter((source) => source.connected) ?? [];
  const items = sessionEvidenceItems({
    ...evidence,
    outputs: artifactDeliverables(evidence.artifacts).filter(
      (artifact) => artifact.session_relation !== 'used',
    ),
    files: sessionFiles(evidence.contextFiles, evidence.tools, evidence.executionProvenance),
    diffs: sessionDiffs(evidence.diffs, evidence.tools, evidence.executionProvenance),
    plans: sessionPlans(evidence.messages, evidence.interactions ?? [], evidence.artifacts),
    sources: sessionSources(
      evidence.messages,
      evidence.processes,
      evidence.resources ?? [],
      evidence.executionProvenance,
      evidence.artifacts,
    ),
    backgroundProcesses: evidence.processes,
  });
  const inventory: SessionRailItem[] = [
    {
      id: 'context',
      content: (
        <>
          <ClioContextMeter
            used={evidence.context?.used_tokens}
            limit={evidence.context?.limit_tokens}
            showLabel={false}
          />
          <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
            <span>
              {evidence.context?.used_tokens === undefined
                ? 'Usage unavailable'
                : `${contextTokens(evidence.context.used_tokens)} / ${evidence.context.limit_tokens ? contextTokens(evidence.context.limit_tokens) : 'Limit unknown'}`}
            </span>
            {evidence.onOpenCanvas ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-xs"
                onClick={() => evidence.onOpenCanvas?.('context')}
              >
                View details
              </Button>
            ) : null}
          </div>
          {evidence.contextError ? <p role="alert">{evidence.contextError}</p> : null}
        </>
      ),
    },
  ];
  if (sources.length || connected.error)
    inventory.push({
      id: 'connected',
      count: sources.length,
      content: connected.error ? (
        <p role="alert">Connected sources could not be loaded.</p>
      ) : (
        sources.map((source) => (
          <SessionSummaryRow
            key={source.id}
            icon={<DatabaseIcon />}
            label={source.label}
            onOpen={() => onOpenSource(source)}
          />
        ))
      ),
    });
  if (
    work.error ||
    (evidence.sessionId && evidence.onOpenWork && (work.data?.goal || work.data?.loop))
  )
    inventory.push({
      id: 'goal',
      content: work.error ? (
        <p role="alert">Session work could not be loaded.</p>
      ) : (
        <SessionWorkSummary
          sessionId={evidence.sessionId!}
          onOpen={evidence.onOpenWork!}
          includeTodos={false}
        />
      ),
    });
  if (questions.length && answer?.openQuestion)
    inventory.push({
      id: 'questions',
      count: questions.length,
      content: <OpenQuestionList questions={questions} />,
    });
  if (todos.length)
    inventory.push({
      id: 'todos',
      count: todos.length,
      summary: todoCurrentSummary(todos, (todo) => todo.status),
      content: (
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
                onOpen={evidence.onOpenWork}
              />
            </li>
          )}
        />
      ),
    });
  if (scheduled.length || schedules.error)
    inventory.push({
      id: 'schedules',
      count: scheduled.length,
      content: schedules.error ? (
        <p role="alert">Schedules could not be loaded.</p>
      ) : (
        scheduled.map((schedule) => (
          <SessionSummaryRow
            key={schedule.id}
            icon={<CalendarClockIcon />}
            label={schedule.question}
            metadata={schedule.enabled ? 'Scheduled' : 'Paused'}
            onOpen={evidence.onOpenWork}
          />
        ))
      ),
    });
  return <SessionRail items={[...inventory, ...items]} actions={actions} />;
}
