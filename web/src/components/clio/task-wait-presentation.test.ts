import type { ToolInvocation } from '@clio/core/v3';
import { describe, expect, it } from 'vitest';
import { withTaskWaitPresentation } from './task-wait-presentation';

describe('retained task wait receipts', () => {
  const result = { pending: ['child'], results: [], errors: [], timed_out: true };
  const tool: ToolInvocation = {
    id: 'wait',
    session_id: 'parent',
    name: 'wait_tasks',
    state: 'succeeded',
    input: { tasks: 'child', return_when: 'all', timeout_s: 0 },
    presentation: { summary: '0 task outcomes', blocks: [] },
    output: result,
  };

  it.each([result, [{ type: 'text', text: JSON.stringify(result) }]])(
    'explains pending native and legacy text receipts',
    (output) => {
      const shown = withTaskWaitPresentation({ ...tool, output });
      expect(shown.presentation?.action).toBe('Check all tasks');
      expect(shown.presentation?.summary).toBe('1 pending, 0 results collected');
      expect(shown.presentation?.blocks[0]).toMatchObject({ text: 'child' });
      expect(shown.presentation?.blocks[2]).toMatchObject({
        result_kind: 'snapshot',
        status: 'pending',
      });
      expect(shown.output).toBe(output);
    },
  );

  it('does not replace an unreadable result with a fabricated outcome', () => {
    const unreadable = { ...tool, output: [{ type: 'text', text: 'truncated' }] };
    const shown = withTaskWaitPresentation(unreadable);
    expect(shown.output).toBe(unreadable.output);
    expect(shown.presentation?.blocks.some((block) => block.result_kind === 'completion')).toBe(
      false,
    );
  });

  it('preserves current server-authored presentation', () => {
    const current = {
      ...tool,
      presentation: {
        action: 'Wait for all tasks',
        subject: 'wait-targets',
        summary: 'Pending',
        blocks: [],
      },
    };
    expect(withTaskWaitPresentation(current)).toBe(current);
  });

  it('shows any policy, selected handles, collected output and pending snapshots', () => {
    const shown = withTaskWaitPresentation({
      ...tool,
      input: { tasks: ['ready', 'child'], return_when: 'any' },
      output: {
        pending: ['child'],
        results: [
          {
            handle: 'ready',
            kind: 'Subagent',
            status: 'completed',
            result: { output: 'Audit incomplete.' },
          },
        ],
      },
    });
    expect(shown.presentation?.action).toBe('Wait for any task');
    expect(shown.presentation?.blocks[0].text).toBe('ready, child');
    expect(shown.presentation?.blocks[1].text).toContain('No deadline');
    expect(shown.presentation?.blocks[2]).toMatchObject({
      label: 'ready: Turn ended',
      text: 'Audit incomplete.',
    });
    expect(shown.presentation?.blocks[3].status).toBe('pending');
  });

  it('names an in-flight selection without fabricating completed results', () => {
    const shown = withTaskWaitPresentation({
      ...tool,
      state: 'running',
      output: undefined,
      input: { tasks: ['worker_a', 'worker_b'] },
    });
    expect(shown.presentation?.action).toBe('Wait for all tasks');
    expect(shown.presentation?.summary).toBe('0 task outcomes');
    expect(shown.presentation?.blocks.some((block) => block.result_kind)).toBe(false);
  });

  it('exposes failed work and handle errors', () => {
    const shown = withTaskWaitPresentation({
      ...tool,
      output: {
        pending: [],
        results: [{ handle: 'child', status: 'failed', result: { output: 'Bad input' } }],
        errors: [{ handle: 'missing', error: 'Unknown task handle' }],
      },
    });
    expect(shown.presentation?.status).toBe('degraded');
    expect(shown.presentation?.summary).toBe('1 result collected, 1 unsuccessful, 1 error');
    expect(shown.presentation?.blocks.at(-1)).toMatchObject({
      severity: 'error',
      text: 'Unknown task handle',
    });
  });
});
