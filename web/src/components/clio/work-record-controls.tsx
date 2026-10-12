import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { WorkRecord } from '@clio/core/v3';
import { Button } from '@/components/ui/button';
import { useRepository } from '@/hooks/use-repository';
import { useConnectionSettings } from '@/providers/connection-provider';

/** Explicit user controls, scoped to the retained identity rather than list position. */
export function WorkRecordControls({
  sessionId,
  kind,
  record,
}: {
  sessionId: string;
  kind: 'goal' | 'loop';
  record: WorkRecord;
}) {
  const repository = useRepository();
  const client = useQueryClient();
  const { settings } = useConnectionSettings();
  const control = useMutation({
    mutationFn: (action: 'stop' | 'restart' | 'delete') =>
      repository.controlSessionWork(sessionId, kind, record.id, action),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['session-work', settings.endpoint, sessionId] });
      await client.invalidateQueries({
        queryKey: ['session-work-schedules', settings.endpoint, sessionId],
      });
    },
  });
  const active = record.state === 'active';
  return (
    <>
      <details className="text-muted-foreground">
        <summary className="cursor-pointer">Details</summary>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 py-1">
          {Object.entries(record.details ?? {}).map(([name, value]) => (
            <div className="contents" key={name}>
              <dt>
                {(
                  {
                    max_goal_iters: 'Turn limit',
                    max_iters: 'Iteration limit',
                    max_wallclock_s: 'Time limit (seconds)',
                    max_tokens: 'Token limit',
                    max_usd: 'Cost limit (USD)',
                    interval_s: 'Interval (seconds)',
                    stop_text: 'Stop text',
                    waiting_tasks: 'Waiting for',
                    judge_reason: 'Judge guidance',
                    progress: 'Verified progress',
                  } as Record<string, string>
                )[name] ?? name}
              </dt>
              <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {value === 0
                  ? 'Unlimited'
                  : Array.isArray(value)
                    ? value.join(', ')
                    : String(value || '—')}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={control.isPending}
          onClick={() => control.mutate(active ? 'stop' : 'restart')}
        >
          {active ? 'Stop' : 'Restart'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={control.isPending}
          onClick={() => control.mutate('delete')}
        >
          Cancel and delete
        </Button>
      </div>
      {control.error ? <p role="alert">{control.error.message}</p> : null}
    </>
  );
}
