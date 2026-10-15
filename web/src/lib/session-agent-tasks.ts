import { operationalRunStateSchema, type AgentTaskRecord, type SubagentRun } from '@clio/core/v3';

/**
 * Agent aliases use the same operational-state decoder as Runs and Work.
 * Unknown future or historical states remain explicitly unknown.
 */
/** Project one task snapshot into the child-agent record the UI already renders. */
export function agentTaskToSubagent(task: AgentTaskRecord): SubagentRun {
  const rawState = task.live_state || task.status;
  const title = task.run_label || `${task.expert_id || 'agent'} #${task.run_index + 1}`;
  const summary = task.error_reason || task.answer_excerpt;
  return {
    id: task.task_id,
    session_id: task.parent_session_id,
    ...(task.parent_turn_id ? { parent_run_id: task.parent_turn_id } : {}),
    ...(task.child_session_id ? { child_session_id: task.child_session_id } : {}),
    ...(task.expert_id ? { agent_id: task.expert_id } : {}),
    title,
    state: operationalRunStateSchema.parse(rawState),
    ...(summary ? { summary } : {}),
    ...(task.answer_excerpt ? { result: task.answer_excerpt } : {}),
  };
}

/**
 * One child-agent list for a session: every task the registry holds, plus any
 * live record the registry read has not caught up with yet.
 *
 * The registry read is the source of truth for state (it is refetched whenever
 * the live records change); a live record contributes what the registry does
 * not carry (the delegated task text, duration, skill origin). Registry order
 * (newest first) is kept; live-only records follow.
 */
export function mergeSessionSubagents(
  live: readonly SubagentRun[],
  tasks: readonly AgentTaskRecord[] | undefined,
): SubagentRun[] {
  if (!tasks?.length) return [...live];
  const liveById = new Map(live.map((subagent) => [subagent.id, subagent]));
  const merged = tasks.map((task) => {
    const fromRegistry = agentTaskToSubagent(task);
    const fromLive = liveById.get(task.task_id);
    return fromLive ? { ...fromLive, ...fromRegistry, title: fromLive.title } : fromRegistry;
  });
  const known = new Set(merged.map((subagent) => subagent.id));
  return [...merged, ...live.filter((subagent) => !known.has(subagent.id))];
}

/** A cache key that changes whenever a live child record appears or changes state. */
export function liveSubagentSignature(live: readonly SubagentRun[]): string {
  return live
    .map((subagent) => `${subagent.id}:${subagent.state}`)
    .sort()
    .join('|');
}
