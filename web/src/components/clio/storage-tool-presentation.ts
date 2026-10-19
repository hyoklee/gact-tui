import type { ToolInvocation } from '@clio/core/v3';

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function submissionResult(output: unknown): Record<string, unknown> | undefined {
  // Earlier native returns were retained as a JSON text part, rather than a mapping.
  if (Array.isArray(output) && output.length === 1) output = record(output[0])?.text;
  if (typeof output === 'string') {
    try {
      output = JSON.parse(output);
    } catch {
      return undefined;
    }
  }
  const outer = record(output);
  return record(outer?.structuredContent) ?? record(outer?.structured_content) ?? outer;
}

/** Repair legacy source receipts using their recorded task acceptance, without rerunning them. */
export function withStorageToolPresentation(tool: ToolInvocation): ToolInvocation {
  const captureSummary = tool.presentation?.summary;
  if (
    tool.name === 'connected_data_ndp_endpoint_request' &&
    captureSummary &&
    /^\d+ bytes captured \u00b7 /u.test(captureSummary)
  )
    return {
      ...tool,
      presentation: {
        ...tool.presentation,
        summary: captureSummary.replace(' \u00b7 ', ', '),
        blocks: tool.presentation?.blocks ?? [],
      },
    };
  if (
    !['connected_data_connect', 'connected_data_download'].includes(tool.name) ||
    tool.state !== 'succeeded'
  )
    return tool;
  const summary = tool.presentation?.summary;
  if (summary && !['Connected data is unavailable', '0 task outcomes'].includes(summary))
    return tool;
  const row = submissionResult(tool.output);
  if (row?.accepted !== true || typeof row.handle !== 'string' || !row.handle.trim()) return tool;
  const kind = row.kind === 'Indexing' || row.kind === 'Download' ? row.kind : 'Task';
  const completed = row.status === 'completed';
  const failed = ['failed', 'cancelled', 'interrupted', 'denied', 'error'].includes(
    String(row.status),
  );
  return {
    ...tool,
    presentation: {
      ...tool.presentation,
      summary: `${kind} ${completed ? 'completed' : failed ? 'unsuccessful' : 'requested'}`,
      ...(failed ? { status: 'degraded' } : {}),
      blocks: [
        {
          id: 'task-submission',
          type: 'text',
          label: typeof row.description === 'string' ? row.description : kind,
          text: `Task: ${row.handle}`,
          status: completed || failed ? String(row.status) : 'pending',
          result_kind: completed || failed ? 'completion' : 'snapshot',
          ...(failed ? { severity: 'error' } : {}),
        },
      ],
    },
  };
}
