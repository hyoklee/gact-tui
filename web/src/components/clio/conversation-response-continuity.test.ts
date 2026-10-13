import type { Message } from '@clio/core/v3';
import { describe, expect, it } from 'vitest';
import { conversationResponseContinuity } from './conversation-message-projection';

function message(id: string, role: Message['role'], session = 's'): Message {
  return { id, role, session_id: session, created_at: '2026-10-12T00:00:00Z', blocks: [] };
}

describe('conversation response continuity', () => {
  it('keeps assistant segments together across recorded controller injections', () => {
    const messages: Message[] = [
      message('human', 'user'),
      message('question', 'assistant'),
      {
        ...message('wake', 'system'),
        blocks: [
          { id: 'reminder', type: 'injection', source: 'todos', text: 'Continue the work.' },
        ],
      },
      message('resumed', 'assistant'),
    ];
    const result = conversationResponseContinuity(messages);
    expect([...result.continued]).toEqual(['question']);
    expect([...result.continuations]).toEqual(['resumed']);
    expect(messages[2]?.id).toBe('wake');
  });

  it('starts a new response after a human prompt or a conversation boundary', () => {
    const result = conversationResponseContinuity([
      message('first', 'assistant'),
      message('human', 'user'),
      message('second', 'assistant'),
      message('other', 'assistant', 'other-session'),
    ]);
    expect([...result.continued]).toEqual([]);
    expect([...result.continuations]).toEqual([]);
  });

  it('retains a distinct non-injection system message as a boundary', () => {
    const result = conversationResponseContinuity([
      message('first', 'assistant'),
      {
        ...message('system', 'system'),
        blocks: [{ id: 'notice', type: 'text', text: 'System notice.' }],
      },
      message('second', 'assistant'),
    ]);
    expect([...result.continuations]).toEqual([]);
  });
});
