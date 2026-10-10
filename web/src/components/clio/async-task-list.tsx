import type { AsyncProcess } from '@clio/core/v3';
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  LoaderCircleIcon,
  PauseIcon,
  PlayIcon,
} from 'lucide-react';
import { CloseIcon, RetryIcon } from '@/lib/icon-vocabulary';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { taskProgressLabel } from './task-progress-label';

const settled = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

export interface AsyncTaskListProps {
  processes: readonly AsyncProcess[];
  onCancelTask?: (task: AsyncProcess) => Promise<void>;
  onControlTask?: (task: AsyncProcess, action: 'pause' | 'resume' | 'restart') => Promise<void>;
}

export function AsyncTaskList({ processes, onCancelTask, onControlTask }: AsyncTaskListProps) {
  const [selected, setSelected] = useState<AsyncProcess>();
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const submitting = useRef(new Set<string>());
  const [error, setError] = useState('');
  const [restart, setRestart] = useState<AsyncProcess>();
  const [controlling, setControlling] = useState<Record<string, string>>({});
  const control = async (task: AsyncProcess, action: 'pause' | 'resume' | 'restart') => {
    if (!onControlTask) return;
    const handle = task.handle ?? task.handle_id ?? task.id;
    const key = `control:${handle}`;
    if (submitting.current.has(key)) return;
    submitting.current.add(key);
    setControlling((previous) => ({ ...previous, [handle]: action }));
    setRestart(undefined);
    setError('');
    try {
      await onControlTask(task, action);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      submitting.current.delete(key);
      setControlling((previous) => {
        const next = { ...previous };
        delete next[handle];
        return next;
      });
    }
  };
  const confirm = async () => {
    if (!selected || !onCancelTask) return;
    const handle = selected.handle ?? selected.handle_id ?? selected.id;
    if (submitting.current.has(handle)) return;
    submitting.current.add(handle);
    setRequested((previous) => new Set([...previous, handle]));
    setSelected(undefined);
    setError('');
    try {
      await onCancelTask(selected);
    } catch (reason) {
      submitting.current.delete(handle);
      setRequested((previous) => new Set([...previous].filter((value) => value !== handle)));
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return (
    <div className="min-w-0 space-y-2" aria-label="Background tasks">
      {processes.map((task) => {
        const handle = task.handle ?? task.handle_id ?? task.id;
        const status = task.effective_status ?? task.live_state;
        const active = !settled.has(status);
        const cancellable = task.supported_actions?.includes('cancel');
        const cancelling =
          (active || cancellable) && (task.cancel_requested || requested.has(handle));
        const held = status === 'paused' || status === 'pause_requested';
        const Icon = held
          ? PauseIcon
          : active
            ? LoaderCircleIcon
            : status === 'completed'
              ? CheckCircle2Icon
              : CircleAlertIcon;
        const kind = task.task_kind ?? (task.kind === 'agent' ? 'Subagent' : 'MCP');
        const progress = taskProgressLabel(task.progress, kind);
        return (
          <div key={handle} className="flex min-w-0 items-start gap-2 rounded-md border p-2">
            <Icon
              aria-hidden="true"
              className={`mt-0.5 size-4 shrink-0 ${active && !held ? 'animate-spin motion-reduce:animate-none' : ''}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {kind} · {task.title}
              </p>
              <p className="break-words text-sm">
                {task.description || 'Description unavailable for this older task'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {cancelling
                  ? 'Cancellation requested'
                  : controlling[handle]
                    ? `${controlling[handle]} requested`
                    : status.replaceAll('_', ' ')}
                {progress ? ` — ${progress}` : ''}
              </p>
            </div>
            {onControlTask
              ? (['pause', 'resume', 'restart'] as const)
                  .filter((action) => task.supported_actions?.includes(action))
                  .map((action) => {
                    const ActionIcon =
                      action === 'pause' ? PauseIcon : action === 'resume' ? PlayIcon : RetryIcon;
                    return (
                      <Button
                        key={action}
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${action} Subagent: ${task.description || task.title}`}
                        disabled={Boolean(
                          controlling[handle] || cancelling || status === 'pause_requested',
                        )}
                        onClick={() =>
                          action === 'restart' ? setRestart(task) : void control(task, action)
                        }
                      >
                        <ActionIcon aria-hidden="true" className="size-4" />
                      </Button>
                    );
                  })
              : null}
            {cancellable && onCancelTask ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Cancel ${kind}: ${task.description || task.title}`}
                disabled={Boolean(cancelling)}
                onClick={() => {
                  setError('');
                  setSelected(task);
                }}
              >
                <CloseIcon aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
          </div>
        );
      })}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <AlertDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
      >
        <AlertDialogContent layer="task-confirmation" className="flex flex-col overflow-hidden">
          <AlertDialogHeader className="shrink-0">
            <AlertDialogTitle>Cancel this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected?.task_kind === 'Subagent' || selected?.kind === 'agent'
                ? 'This also cancels all descendant agents, downloads and shell processes.'
                : 'Cancellation is requested from its owner and may take time to finish.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            role="region"
            aria-label="Task assignment"
            tabIndex={0}
            className="min-h-0 max-h-[50dvh] overflow-y-auto rounded-md border p-2"
          >
            <p className="break-words text-sm [overflow-wrap:anywhere]">
              {selected?.description || selected?.title}
            </p>
          </div>
          <AlertDialogFooter className="shrink-0">
            <AlertDialogCancel>Keep running</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirm()}>Cancel task</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(restart)}
        onOpenChange={(open) => {
          if (!open) setRestart(undefined);
        }}
      >
        <AlertDialogContent layer="task-confirmation" className="flex flex-col overflow-hidden">
          <AlertDialogHeader className="shrink-0">
            <AlertDialogTitle>Restart this subagent?</AlertDialogTitle>
            <AlertDialogDescription>
              Create a linked new run with retained context. Accepted operations will not be
              replayed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            role="region"
            aria-label="Task assignment"
            tabIndex={0}
            className="min-h-0 max-h-[50dvh] overflow-y-auto rounded-md border p-2"
          >
            <p className="break-words text-sm [overflow-wrap:anywhere]">
              {restart?.description || restart?.title}
            </p>
          </div>
          <AlertDialogFooter className="shrink-0">
            <AlertDialogCancel>Keep this run</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (restart) void control(restart, 'restart');
              }}
            >
              Restart subagent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
