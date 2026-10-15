import type { Session, TaskSnapshot, TranscriptSnapshot, Workspace } from '@clio/core/v3';
import { describe, expect, it } from 'vitest';
import { buildWorkflowRows } from './runs-page';

describe('workflow run indexing', () => {
  it('indexes only recorded workflows and preserves their canvas deep-link identity', () => {
    const session: Session = {
      id: 'session_root',
      workspace_id: 'workspace_1',
      title: 'Workflow session',
      state: 'completed',
      created_at: '2026-09-11T00:00:00Z',
      updated_at: '2026-09-11T00:01:00Z',
      mode: 'edit',
      edit_mode: 'diff',
      routing_mode: 'auto',
      approval_mode: 'ask',
      pinned: false,
      archived: false,
    };
    const workspace: Workspace = {
      id: 'workspace_1',
      name: 'qualification',
      display_name: 'Qualification',
      path: 'D:\\qualification',
      connection_id: 'local',
      pinned: false,
    };
    const transcript: TranscriptSnapshot = {
      cursor: '2',
      messages: [],
      tasks: [],
      subagents: [],
      artifacts: [],
      surfaces: [],
      tools: [
        {
          id: 'call_workflow',
          session_id: 'session_root',
          name: 'run_workflow',
          state: 'succeeded',
          duration_ms: 30_000,
          completed_at: '2026-09-11T00:00:30Z',
          output: {
            steps: [
              { child: 'inventory', task_id: 'task_inventory' },
              { child: 'verification', task_id: 'task_verification' },
            ],
          },
        },
        {
          id: 'call_wait',
          session_id: 'session_root',
          name: 'wait_agent_tasks',
          state: 'succeeded',
        },
      ],
    };

    const completed = (handle: string): TaskSnapshot => ({
      handle,
      kind: 'Subagent',
      owner: {
        human_id: 'human',
        session_id: 'child',
        assignment_id: handle,
        parent_handle: 'root',
      },
      label: 'Step',
      description: 'Original assignment',
      description_reference: null,
      description_missing: false,
      tool: 'conversation',
      invocation_id: handle,
      status: 'completed',
      raw_status: 'completed',
      activity: '',
      progress: { message: '', completed: null, total: null, unit: '', output: null },
      supported_actions: [],
      cancellation_requested_at: null,
      terminal_at: '2026-09-11T00:00:30Z',
      connection_freshness: 'fresh',
      settlement: 'confirmed',
      recording: 'confirmed',
      result: null,
      details: null,
      backend: null,
      created_at: '2026-09-11T00:00:00Z',
      updated_at: '2026-09-11T00:00:30Z',
    });
    const tasks = [completed('task_inventory'), completed('task_verification')];
    expect(buildWorkflowRows([transcript], [session], [workspace], tasks)).toEqual([
      expect.objectContaining({
        label: 'inventory → verification',
        source: 'workflow',
        state: 'completed',
        taskId: 'call_workflow',
        targetSessionId: 'session_root',
        updatedAt: '2026-09-11T00:00:30Z',
        workspaceId: 'workspace_1',
        workflow: expect.objectContaining({ id: 'call_workflow' }),
      }),
    ]);
    expect(buildWorkflowRows([transcript], [session], [workspace])[0]).toMatchObject({
      state: 'unknown',
    });
    const stopped = {
      ...transcript,
      tools: transcript.tools.map((tool) => ({ ...tool, state: 'cancelled' as const })),
    };
    const active = tasks.map((task) => ({
      ...task,
      status: 'active',
      raw_status: 'working',
      terminal_at: null,
    }));
    expect(buildWorkflowRows([stopped], [session], [workspace], active)[0]).toMatchObject({
      state: 'running',
    });
  });
});
