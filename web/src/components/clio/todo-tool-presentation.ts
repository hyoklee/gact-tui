import type { ToolInvocation } from '@clio/core/v3';

/** Keep retained checklist calls distinct from asynchronous task controls. */
export function withTodoPresentation(tool: ToolInvocation): ToolInvocation {
  if (tool.name !== 'write_todos') return tool;
  return {
    ...tool,
    title: 'Update Todos',
    presentation: tool.presentation
      ? {
          ...tool.presentation,
          action: 'Update Todos',
          summary: tool.presentation.summary
            .replace(/^(\d+) tasks? changed$/u, '$1 todos changed')
            .replace(/^1 todos changed$/u, '1 todo changed')
            .replace(/^No tasks in this list$/u, 'No todos in this list'),
        }
      : undefined,
  };
}
