import {
  createEntityState,
  reduceTransportFrame,
  type Message as DomainMessage,
  type TransportFrame,
} from '@clio/core/v3';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ConversationDisplayProvider } from '@/providers/conversation-display-provider';
import { TranscriptTestAppearance as AppearanceProvider } from '@/test/transcript-test-appearance';
import { ClioConversation } from './conversation';

vi.mock('@tanstack/react-virtual', () => ({
  defaultRangeExtractor: () => [],
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 180,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        end: (index + 1) * 180,
        index,
        key: index,
        size: 180,
        start: index * 180,
      })),
    measureElement: () => undefined,
    measure: () => undefined,
    scrollToIndex: vi.fn(),
  }),
}));

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', window.location.pathname);
});

function renderConversation(element: ReactElement) {
  return render(
    <AppearanceProvider>
      <ConversationDisplayProvider>{element}</ConversationDisplayProvider>
    </AppearanceProvider>,
  );
}

it('keeps a consumed steer before its reply after live tool completion', () => {
  let state = createEntityState();
  let cursor = 0;
  const send = (type: string, payload: unknown) => {
    const frame: TransportFrame = {
      cursor: String(++cursor),
      eventName: type,
      receivedAt: '2026-10-13T17:55:00Z',
      data: {
        protocol_version: '0.3',
        type,
        occurred_at: '2026-10-13T17:55:00Z',
        scope: { connection_id: 'local', workspace_id: 'w', session_id: 's' },
        payload,
      },
    };
    state = reduceTransportFrame(state, frame);
  };
  const feedbackMessage: DomainMessage = {
    ...feedbackForTool(),
    metadata: undefined,
  };
  send('message.upserted', {
    id: 'answer-tool-feedback',
    session_id: 's',
    run_id: 'active-steer-turn',
    role: 'assistant',
    created_at: '2026-10-13T17:54:00Z',
    blocks: [],
  });
  send('message.block.upserted', {
    message_id: 'answer-tool-feedback',
    block: { id: 'call-anchor', type: 'tool', tool_id: 'check' },
  });
  send('tool.upserted', {
    id: 'check',
    session_id: 's',
    name: 'shell_bash',
    title: 'Check execution',
    state: 'succeeded',
    input: { command: 'Write-Output check' },
    output: 'check',
  });
  send('message.upserted', feedbackMessage);
  const conversation = () => (
    <ClioConversation
      messages={Object.values(state.messages)}
      artifacts={{}}
      subagents={{}}
      surfaces={{}}
      tasks={{}}
      tools={state.tools}
      preparation={{ sessionState: 'running', activeTurnId: 'active-steer-turn' }}
    />
  );
  const view = renderConversation(conversation());
  expect(screen.getAllByText('Why is the check taking so long?')).toHaveLength(1);
  send('message.block.upserted', {
    message_id: 'answer-tool-feedback',
    block: { id: 'completed-result', type: 'tool', tool_id: 'check' },
  });
  send('message.upserted', feedbackForTool());
  send('message.block.upserted', {
    message_id: 'answer-tool-feedback',
    block: {
      id: 'reply-to-feedback',
      type: 'text',
      channel: 'next_thought',
      text: 'The check has finished; I will continue with the report.',
    },
  });
  view.rerender(
    <AppearanceProvider>
      <ConversationDisplayProvider>{conversation()}</ConversationDisplayProvider>
    </AppearanceProvider>,
  );
  const user = screen.getByText('Why is the check taking so long?');
  const reply = screen.getByText('The check has finished; I will continue with the report.');
  expect(user.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getAllByText('Why is the check taking so long?')).toHaveLength(1);
  expect(view.container.querySelector('[data-slot="message-completion-footer"]')).toBeNull();
});

function feedbackForTool(): DomainMessage {
  return {
    id: 'user-tool-feedback',
    session_id: 's',
    role: 'user',
    created_at: '2026-10-13T17:55:00Z',
    metadata: {
      steer_delivery: {
        assistant_message_id: 'answer-tool-feedback',
        after_part_id: 'call-anchor',
      },
    },
    blocks: [{ id: 'user-tool-text', type: 'text', text: 'Why is the check taking so long?' }],
  };
}
