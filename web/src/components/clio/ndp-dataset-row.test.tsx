import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { NDPDataset } from '@clio/core/v3';
import { NDPDatasetRow } from './ndp-dataset-row';

const dataset: NDPDataset = {
  id: 'measurements',
  name: 'measurements',
  title: 'Scientific measurements',
  endpoint_id: 'public',
  endpoint_name: 'Public catalog',
  description: 'Measured observations with a detailed description.',
  access: null,
  resources: Array.from({ length: 25 }, (_, index) => ({
    id: `file-${index + 1}`,
    path: `file-${index + 1}.nc`,
    name: `Observation ${index + 1}`,
    format: 'NetCDF',
    size: 1024,
    revision: 'v1',
  })),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Selection() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <NDPDatasetRow
      dataset={dataset}
      selected={selected}
      disabled={false}
      onChange={(id, checked) =>
        setSelected((previous) =>
          checked ? [...previous, id] : previous.filter((value) => value !== id),
        )
      }
    />
  );
}

it('mounts resources only on opening and retains selection through disclosure and paging', async () => {
  render(<Selection />);
  const user = userEvent.setup();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  const header = screen.getByRole('button', { name: 'Scientific measurements' });
  header.focus();
  await user.keyboard('{Enter}');
  expect(screen.getAllByRole('checkbox')).toHaveLength(10);
  await user.click(screen.getByRole('checkbox', { name: 'Observation 1' }));
  await user.click(screen.getByRole('button', { name: 'Show 10 more resources' }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(20);
  await user.click(screen.getByRole('button', { name: 'Show 5 more resources' }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(25);
  await user.click(screen.getByRole('checkbox', { name: 'Observation 25' }));
  await user.click(screen.getByRole('button', { name: 'Resources (25)' }));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Resources (25)' }));
  expect(screen.getByRole('checkbox', { name: 'Observation 25' })).toBeChecked();
  await user.click(header);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(header).toHaveTextContent('2 selected');
  await user.click(header);
  expect(screen.getByRole('checkbox', { name: 'Observation 1' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Observation 25' })).toBeChecked();
});

it('offers full text only when the three-line description actually overflows', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(240);
  render(
    <NDPDatasetRow
      dataset={dataset}
      selected={[]}
      disabled={false}
      onChange={vi.fn()}
      defaultOpen
    />,
  );
  const user = userEvent.setup();
  const paragraph = screen.getByText(dataset.description);
  expect(paragraph).toHaveClass('line-clamp-3');
  await user.click(screen.getByRole('button', { name: 'Show more' }));
  expect(paragraph).not.toHaveClass('line-clamp-3');
  await user.click(screen.getByRole('button', { name: 'Show less' }));
  expect(paragraph).toHaveClass('line-clamp-3');
});

it('shows short text without an unnecessary more control and honors disabled resources', () => {
  render(<NDPDatasetRow dataset={dataset} selected={[]} disabled onChange={vi.fn()} defaultOpen />);
  expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('checkbox').every((box) => box.hasAttribute('disabled'))).toBe(true);
});
