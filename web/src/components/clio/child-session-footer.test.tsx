import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClioChildSessionFooter } from './child-session-footer';

const mocks = vi.hoisted(() => ({
  repository: { session: vi.fn(), submitMessage: vi.fn() },
}));
vi.mock('@/hooks/use-repository', () => ({ useRepository: () => mocks.repository }));
vi.mock('@/providers/connection-provider', () => ({
  useConnectionSettings: () => ({
    settings: { endpoint: 'http://child.test', token: 'account-a' },
  }),
}));

beforeEach(() => {
  sessionStorage.clear();
  mocks.repository.session.mockReset().mockResolvedValue({
    id: 'child',
    parent_session_id: 'parent',
    workspace_id: 'ws',
    archived: false,
    mode: 'plan',
    approval_mode: 'ask',
    effort: 'low',
  });
  mocks.repository.submitMessage.mockReset().mockResolvedValue({ state: 'started' });
});
afterEach(cleanup);

const target = { session: { id: 'child', parent_session_id: 'parent', workspace_id: 'ws' } };

describe('ClioChildSessionFooter', () => {
  it('continues completed child work in its existing conversation and keeps parent navigation', async () => {
    const user = userEvent.setup();
    const onReturnToParent = vi.fn();
    render(
      <ClioChildSessionFooter
        {...target}
        parentTitle="Single child investigation"
        state="completed"
        onReturnToParent={onReturnToParent}
      />,
    );

    expect(screen.getByText('Delegated conversation')).toBeVisible();
    expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Message this agent' }),
      'Check calibration',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Follow-up sent');
    expect(mocks.repository.submitMessage).toHaveBeenCalledWith(
      'child',
      expect.objectContaining({
        delivery: 'auto',
        parts: [{ type: 'text', text: 'Check calibration' }],
        behavior: {
          execution_mode: 'plan',
          confirmation_policy: 'ask',
          reasoning_effort: 'low',
        },
      }),
      expect.any(AbortSignal),
    );
    expect(mocks.repository.submitMessage.mock.calls[0]![1]).not.toHaveProperty('model');

    await user.click(
      screen.getByRole('button', {
        name: 'Return to parent conversation Single child investigation',
      }),
    );
    expect(onReturnToParent).toHaveBeenCalledOnce();
  });

  it('steers a running child while keeping its structured questions available', async () => {
    mocks.repository.submitMessage.mockResolvedValue({ state: 'pending_steer' });
    const user = userEvent.setup();
    render(
      <ClioChildSessionFooter
        {...target}
        parentTitle="Single child investigation"
        pendingInteractions={<button type="button">Answer child question</button>}
        state="running"
        onReturnToParent={vi.fn()}
      />,
    );

    expect(screen.getByText(/steer this agent while it works/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Answer child question' })).toBeVisible();
    await user.type(
      screen.getByRole('textbox', { name: 'Message this agent' }),
      'Keep raw data intact',
    );
    await user.keyboard('{Enter}');
    await screen.findByText('Follow-up will join the running conversation');
    expect(mocks.repository.submitMessage).toHaveBeenCalledTimes(1);
    expect(mocks.repository.submitMessage.mock.calls[0]![0]).toBe('child');
  });
});
