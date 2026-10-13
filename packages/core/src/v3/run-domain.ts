/** Shared execution states for foreground runs and task-backed agents. */
export type RunState =
  | 'queued'
  | 'running'
  | 'pause_requested'
  | 'paused'
  | 'yielded'
  | 'recovery_required'
  | 'waiting_permission'
  | 'waiting_user'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'unknown';
