import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { SessionEvidenceSummary } from './session-evidence-summary';

function Evidence({ withTools = true }: { withTools?: boolean }) {
  return (
    <SessionEvidenceSummary
      outputs={[]}
      files={[]}
      diffs={[]}
      plans={[]}
      sources={[]}
      runs={[]}
      tasks={[]}
      subagents={[]}
      backgroundProcesses={[]}
      tools={
        withTools
          ? [
              {
                id: 'read',
                session_id: 's',
                name: 'read',
                state: 'succeeded',
                presentation: { action: 'Read sample', summary: '', blocks: [] },
              },
            ]
          : []
      }
    />
  );
}
beforeEach(() => {
  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage', { key: null }));
});
afterEach(cleanup);

it('starts tool calls collapsed and remembers both opening and closing after dismissal', async () => {
  const user = userEvent.setup();
  const first = render(<Evidence />);
  expect(screen.getByRole('button', { name: 'Tool calls, 1 recorded' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await user.click(screen.getByRole('button', { name: 'Tool calls, 1 recorded' }));
  first.rerender(<Evidence withTools={false} />);
  first.rerender(<Evidence />);
  expect(screen.getByRole('button', { name: 'Tool calls, 1 recorded' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  first.unmount();
  const second = render(<Evidence />);
  expect(screen.getByRole('button', { name: 'Tool calls, 1 recorded' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await user.click(screen.getByRole('button', { name: 'Tool calls, 1 recorded' }));
  second.unmount();
  render(<Evidence />);
  expect(screen.getByRole('button', { name: 'Tool calls, 1 recorded' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});
