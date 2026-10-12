import type { Message } from '@clio/core/v3';
import { expect, it } from 'vitest';
import { placeHarnessInjections } from './conversation-injection-placement';
import { conversationTurnPresentation } from './conversation-turn-model';

const injection: Message = {
  id: 'results',
  session_id: 's',
  role: 'system',
  created_at: '2026-10-12T12:00:00Z',
  blocks: [
    {
      id: 'result-block',
      type: 'injection',
      source: 'task_results',
      text: 'The audit returned.',
      sequence: 30,
    },
  ],
};
const answer: Message = {
  id: 'answer',
  session_id: 's',
  role: 'assistant',
  created_at: '2026-10-12T12:00:01Z',
  blocks: [{ id: 'read', type: 'tool', tool_id: 'read', sequence: 1 }],
};

it('groups consecutive harness entries with the next response, preserving their identities and order', () => {
  const reminder: Message = {
    ...injection,
    id: 'reminder',
    blocks: [
      {
        id: 'reminder-block',
        type: 'injection',
        source: 'plan_mode',
        text: 'Keep the requested scope.',
      },
    ],
  };
  const placed = placeHarnessInjections([injection, reminder, answer]);
  expect([...placed.grouped]).toEqual(['results', 'reminder']);
  expect(placed.before.get(answer.id)).toEqual([injection, reminder]);
  const view = conversationTurnPresentation(
    answer,
    { read: { id: 'read', session_id: 's', name: 'fs_read_file', state: 'succeeded' } },
    {},
    [],
    placed.before.get(answer.id),
  );
  expect(view.iterations.flatMap((row) => row.activity.map((entry) => entry.id))).toEqual([
    'result-block',
    'reminder-block',
    'read',
  ]);
  expect(injection.blocks[0]?.sequence).toBe(30);
  expect(answer.blocks).toHaveLength(1);
});

it('keeps unmatched injections at their own boundary until a following response arrives', () => {
  expect(placeHarnessInjections([injection]).grouped.size).toBe(0);
  const view = conversationTurnPresentation(injection, {});
  expect(view.iterations[0]?.activity[0]).toMatchObject({ kind: 'injection', id: 'result-block' });
  expect(view.residualBlocks).toEqual([]);
});

it('does not move an injection across a human message or another conversation', () => {
  const human: Message = { ...answer, id: 'human', role: 'user', blocks: [] };
  expect(placeHarnessInjections([injection, human, answer]).grouped.size).toBe(0);
  expect(
    placeHarnessInjections([injection, { ...answer, session_id: 'another' }]).grouped.size,
  ).toBe(0);
});
