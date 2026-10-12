import type { Message, PendingInteraction } from '@clio/core/v3';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ConversationDisplayProvider } from '@/providers/conversation-display-provider';
import { TranscriptTestAppearance as AppearanceProvider } from '@/test/transcript-test-appearance';
import { ClioConversation } from './conversation';
import { QuestionAnswerContext } from './question-answer-context';

// JSDOM has no element scrolling; browser navigation is covered by Playwright.
Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('keeps the open question list when the first transcript messages arrive', async () => {
  const interaction: PendingInteraction = {
    id: 'question-units',
    kind: 'question',
    status: 'pending',
    owner_session_id: 's',
    attended_session_id: 's',
    title: 'Confirm the units',
    prompt: 'Which units should I use?',
    created_at: '2026-10-12T00:00:00Z',
    source: { protocol: 'native', tool_name: 'ask_user', invocation_id: 'question-tool' },
    payload: { response_mode: 'async', question_kind: 'freeform' },
    actions: ['answer'],
  };
  const openQuestion = vi.fn();
  const content = (messages: Message[]) => (
    <AppearanceProvider>
      <ConversationDisplayProvider>
        <QuestionAnswerContext.Provider
          value={{ openQuestion, startAnswer: vi.fn(), stopAnswer: vi.fn() }}
        >
          <ClioConversation
            sessionId="s"
            messages={messages}
            interactions={[interaction]}
            artifacts={{}}
            subagents={{}}
            surfaces={{}}
            tasks={{}}
            tools={{}}
          />
        </QuestionAnswerContext.Provider>
      </ConversationDisplayProvider>
    </AppearanceProvider>
  );
  const view = render(content([]));
  await userEvent.click(screen.getByRole('button', { name: '1 open question' }));
  expect(screen.getByRole('dialog', { name: 'Open questions' })).toBeVisible();
  view.rerender(
    content([
      {
        id: 'message-loaded',
        session_id: 's',
        role: 'user',
        created_at: '2026-10-12T00:00:00Z',
        blocks: [{ id: 'loaded-text', type: 'text', text: 'Inspect the measurements.' }],
      },
    ]),
  );
  expect(screen.getByRole('dialog', { name: 'Open questions' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Read and answer' }));
  expect(openQuestion).toHaveBeenCalledWith(interaction);
});
