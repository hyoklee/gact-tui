import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { SearchEnginePicker } from './search-engine-picker';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Review() {
  const [value, setValue] = useState('duckduckgo,arxiv,baidu');
  const [optIn, setOptIn] = useState('baidu');
  return (
    <>
      <SearchEnginePicker
        value={value}
        defaults="duckduckgo,arxiv"
        optIn={optIn}
        onChange={setValue}
        onOptIn={setOptIn}
      />
      <output aria-label="Enabled engines">{value}</output>
      <output aria-label="Opt-in engines">{optIn}</output>
      <button
        onClick={() => {
          setValue('duckduckgo,arxiv,baidu');
          setOptIn('baidu');
        }}
      >
        Discard
      </button>
    </>
  );
}

it('keeps disabled engines visible and updates explicit opt-in together with enablement', async () => {
  const user = userEvent.setup();
  render(<Review />);
  await user.click(screen.getByRole('switch', { name: 'Enable baidu' }));
  expect(screen.getByLabelText('Enabled engines')).toHaveTextContent('duckduckgo,arxiv');
  expect(screen.getByLabelText('Opt-in engines')).toBeEmptyDOMElement();
  expect(screen.getByRole('switch', { name: 'Enable baidu' })).not.toBeChecked();
  await user.click(screen.getByRole('switch', { name: 'Enable baidu' }));
  expect(screen.getByLabelText('Opt-in engines')).toHaveTextContent('baidu');
  expect(screen.getByLabelText('Enabled engines')).toHaveTextContent('duckduckgo,arxiv,baidu');
  await user.click(screen.getByRole('switch', { name: 'Enable baidu' }));
  await user.click(screen.getByRole('switch', { name: 'Enable arxiv' }));
  expect(screen.getByRole('switch', { name: 'Enable duckduckgo' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'About arxiv' }));
  expect(await screen.findByText('Research preprints.')).toBeVisible();
});

it('reorders enabled engines through the shared keyboard drag handle', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const item = this.closest('[role="listitem"]');
    const index = item?.parentElement ? Array.from(item.parentElement.children).indexOf(item) : 0;
    return new DOMRect(0, Math.max(0, index) * 44, 300, 44);
  });
  const user = userEvent.setup();
  render(<Review />);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reorder duckduckgo' })).toHaveFocus();
  await user.keyboard(' ');
  await user.keyboard('{ArrowDown}');
  await user.keyboard(' ');
  expect(screen.getByLabelText('Enabled engines')).toHaveTextContent('arxiv,duckduckgo,baidu');
  await user.click(screen.getByRole('button', { name: 'Discard' }));
  expect(screen.getByLabelText('Enabled engines')).toHaveTextContent('duckduckgo,arxiv,baidu');
  expect(
    screen
      .getAllByRole('button', { name: /^Reorder /u })
      .map((node) => node.getAttribute('aria-label')),
  ).toEqual(['Reorder duckduckgo', 'Reorder arxiv', 'Reorder baidu']);
});
