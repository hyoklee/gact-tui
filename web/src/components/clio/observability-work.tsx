import type { ClioObservabilityDockProps } from './observability-dock-shell';
import { useState } from 'react';
import { ChartNoAxesGanttIcon, GitForkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConversationRelationships } from './conversation-relationships';
import { ClioProcessLanes } from './observability-processes';
import { ConversationGantt } from './conversation-gantt';
import { conversationFamily } from './conversation-relationships-model';
import { useConversationWorkState } from './use-conversation-work-state';

/** Swap ancestry and execution in the existing Observability work surface. */
export function ObservabilityWork(
  props: Pick<
    ClioObservabilityDockProps,
    | 'sessionId'
    | 'familyProvenance'
    | 'familyProvenancePending'
    | 'sessions'
    | 'artifacts'
    | 'onOpenArtifact'
    | 'executionProvenance'
    | 'messages'
    | 'processes'
    | 'runs'
    | 'subagents'
    | 'tools'
    | 'onOpenSubagent'
  >,
) {
  const [{ view, details, selectedId }, update] = useConversationWorkState(props.sessionId ?? '');
  const [relationshipsOpened, setRelationshipsOpened] = useState(view === 'relationships');
  const hasFamily = conversationFamily(props.sessions ?? [], props.sessionId ?? '').sessions.some(
    (session) => session.session_kind === 'branch',
  );
  const relationships = view === 'relationships';
  return (
    <div className="@container min-w-0">
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {relationships
            ? 'Conversation ancestry and ownership'
            : hasFamily && !details
              ? 'Recorded activity across the conversation family'
              : 'Recorded execution · latest turn'}
        </p>
        <div className="flex items-center gap-1">
          {!relationships && hasFamily ? (
            <Button size="sm" variant="ghost" onClick={() => update({ details: !details })}>
              {details ? 'Conversation family' : 'Execution details'}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            aria-label={relationships ? 'Switch to Gantt' : 'Switch to Relationships'}
            onClick={() => {
              setRelationshipsOpened(true);
              update({ view: relationships ? 'gantt' : 'relationships' });
            }}
          >
            {relationships ? <ChartNoAxesGanttIcon /> : <GitForkIcon />}
            {relationships ? 'Gantt' : 'Relationships'}
          </Button>
        </div>
      </div>
      <div hidden={relationships}>
        {hasFamily && !details ? (
          <ConversationGantt
            sessions={props.sessions ?? []}
            sessionId={props.sessionId ?? ''}
            provenance={props.familyProvenance}
            pending={props.familyProvenancePending}
          />
        ) : (
          <ClioProcessLanes {...props} />
        )}
      </div>
      {relationshipsOpened ? (
        <div hidden={!relationships}>
          <ConversationRelationships
            sessions={props.sessions ?? []}
            sessionId={props.sessionId ?? ''}
            artifacts={props.artifacts}
            onOpenArtifact={props.onOpenArtifact}
            selectedId={selectedId}
            onSelect={(selectedId) => update({ selectedId })}
          />
        </div>
      ) : null}
    </div>
  );
}
