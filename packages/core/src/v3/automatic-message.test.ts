import { describe, expect, it } from 'vitest';
import { messageSchema } from './message-schemas.js';

describe('automatic wake transcript authorship', () => {
  it.each([
    [{ goal_redrive: true }, 'goal_judgment'],
    [{ scheduled: true, loop_id: 'loop_1' }, 'loop_wake'],
    [{ scheduled: true, schedule_id: 'sched_1' }, 'scheduled_wake'],
    [{ task_completion_wake: { handles: ['task_1'] } }, 'task_completion'],
  ])('restores older automatic envelopes as injections: %s', (metadata, source) => {
    const parsed = messageSchema.parse({
      id: 'wake', session_id: 'session_1', turn_id: 'wake', role: 'user',
      created_at: '2026-10-12T00:00:00Z', metadata,
      blocks: [{ id: 'instruction', type: 'text', text: 'Continue the original assignment.' }],
    });
    expect(parsed.role).toBe('system');
    expect(parsed.turn_id).toBe('wake');
    expect(parsed.blocks).toEqual([{
      id: 'instruction', type: 'injection', source, text: 'Continue the original assignment.',
    }]);
    expect(messageSchema.parse(parsed)).toEqual(parsed);
  });

  it('preserves an actual human prompt', () => {
    expect(messageSchema.parse({
      id: 'prompt', session_id: 'session_1', role: 'user',
      created_at: '2026-10-12T00:00:00Z',
      blocks: [{ id: 'text', type: 'text', text: 'Please start a goal.' }],
    }).role).toBe('user');
  });
});
