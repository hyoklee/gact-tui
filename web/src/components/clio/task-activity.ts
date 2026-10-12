import type { AsyncProcess, SubagentRun } from '@clio/core/v3';

export interface TaskActivity {
  key: string;
  process?: AsyncProcess;
  subagent?: SubagentRun;
}

/** Join projections by recorded identity, never by title or assignment text. */
export function taskActivity(
  processes: readonly AsyncProcess[],
  subagents: readonly SubagentRun[] = [],
): TaskActivity[] {
  const represented = new Set<SubagentRun>();
  const entries: TaskActivity[] = processes.map((process) => {
    const candidates =
      process.task_kind === 'Subagent' || process.kind === 'agent'
        ? subagents.filter((child) =>
            process.child_session_id
              ? child.child_session_id === process.child_session_id
              : child.id === process.id,
          )
        : [];
    const subagent = candidates.length === 1 ? candidates[0] : undefined;
    if (subagent) represented.add(subagent);
    return { key: process.handle ?? process.handle_id ?? process.id, process, subagent };
  });
  return [
    ...entries,
    ...subagents
      .filter((child) => !represented.has(child))
      .map((subagent) => ({ key: `child:${subagent.id}`, subagent })),
  ];
}
