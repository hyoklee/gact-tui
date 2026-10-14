import type { ToolInvocation } from '@clio/core/v3';
import { describe, expect, it } from 'vitest';
import { withTodoPresentation } from './todo-tool-presentation';

describe('todo terminology', () => {
  const checklist: ToolInvocation = {
    id: 'todos',
    session_id: 'parent',
    name: 'write_todos',
    state: 'succeeded',
    presentation: {
      action: 'Update tasks',
      summary: '3 tasks changed',
      blocks: [{ id: 'todo', type: 'check', text: 'Inspect the data', state: 'completed' }],
    },
  };
  it('renames retained checklist labels and preserves their recorded content', () => {
    const shown = withTodoPresentation(checklist);
    expect(shown.presentation?.action).toBe('Update Todos');
    expect(shown.presentation?.summary).toBe('3 todos changed');
    expect(shown.presentation?.blocks).toBe(checklist.presentation?.blocks);
  });
  it('handles singular, empty and in-flight lists', () => {
    expect(
      withTodoPresentation({
        ...checklist,
        presentation: { ...checklist.presentation!, summary: '1 task changed' },
      }).presentation?.summary,
    ).toBe('1 todo changed');
    expect(
      withTodoPresentation({
        ...checklist,
        presentation: { ...checklist.presentation!, summary: 'No tasks in this list' },
      }).presentation?.summary,
    ).toBe('No todos in this list');
    expect(withTodoPresentation({ ...checklist, presentation: undefined }).title).toBe(
      'Update Todos',
    );
  });
  it('leaves asynchronous task controls unchanged', () => {
    const wait = { ...checklist, name: 'wait_tasks' };
    expect(withTodoPresentation(wait)).toBe(wait);
  });
});
