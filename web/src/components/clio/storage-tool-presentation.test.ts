import type { ToolInvocation } from '@clio/core/v3';
import { describe, expect, it } from 'vitest';
import { withStorageToolPresentation } from './storage-tool-presentation';

const tool: ToolInvocation = {
  id: 'call',
  session_id: 's',
  name: 'connected_data_connect',
  state: 'succeeded',
  presentation: { summary: 'Connected data is unavailable', blocks: [] },
  output: { accepted: true, handle: 'task_index', kind: 'Indexing', status: 'running' },
};

describe('legacy source task presentation', () => {
  it('repairs a recorded indexing acceptance without claiming completion or changing its result', () => {
    const presented = withStorageToolPresentation(tool);
    expect(presented.presentation?.summary).toBe('Indexing requested');
    expect(presented.presentation?.blocks[0]).toMatchObject({
      result_kind: 'snapshot',
      status: 'pending',
      text: 'Task: task_index',
    });
    expect(presented.output).toBe(tool.output);
    expect(tool.presentation?.summary).toBe('Connected data is unavailable');
  });

  it('repairs a download acceptance displayed as zero task outcomes', () => {
    const presented = withStorageToolPresentation({
      ...tool,
      name: 'connected_data_download',
      presentation: { summary: '0 task outcomes', blocks: [] },
      output: { accepted: true, handle: 'task_download', kind: 'Download', status: 'queued' },
    });
    expect(presented.presentation?.summary).toBe('Download requested');
  });

  it.each([
    JSON.stringify(tool.output),
    [{ type: 'text', text: JSON.stringify(tool.output) }],
    { structuredContent: tool.output },
  ])('reads the recorded native/MCP return representation: %j', (output) => {
    expect(withStorageToolPresentation({ ...tool, output }).presentation?.summary).toBe(
      'Indexing requested',
    );
  });

  it.each(['completed', 'failed'])('respects a recorded terminal outcome: %s', (status) => {
    const presented = withStorageToolPresentation({
      ...tool,
      output: { accepted: true, handle: 'task_index', kind: 'Indexing', status },
    });
    expect(presented.presentation?.summary).toBe(
      `Indexing ${status === 'completed' ? 'completed' : 'unsuccessful'}`,
    );
    expect(presented.presentation?.blocks[0].result_kind).toBe('completion');
    if (status === 'failed') expect(presented.presentation?.status).toBe('degraded');
  });

  it('preserves errors, unknown outcomes, unrelated tools and current declared receipts', () => {
    for (const input of [
      { ...tool, state: 'failed' as const },
      { ...tool, state: 'unknown' as const },
      { ...tool, output: {} },
      { ...tool, name: 'other_tool' },
      { ...tool, presentation: { summary: 'Indexing requested', blocks: [] } },
    ])
      expect(withStorageToolPresentation(input)).toBe(input);
  });
});
