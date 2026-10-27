import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { requestViewSelection, useOpenedViewSelection } from './open-view';

const selection = { path: '/selection/case', field: 'case', values: ['c07'] };

it('writes an opened selection into the surface, whether it was shown before or after', () => {
  requestViewSelection('sess_a', 'later', selection);
  const set = vi.fn();
  const model = { dataModel: { set } };
  renderHook(() => useOpenedViewSelection('sess_a', 'later', model));
  expect(set).toHaveBeenCalledWith('/selection/case', {
    field: 'case',
    values: ['c07'],
    source: 'openView',
  });
  set.mockClear();
  requestViewSelection('sess_a', 'later', { ...selection, values: ['c08'] });
  expect(set).toHaveBeenCalledWith('/selection/case', {
    field: 'case',
    values: ['c08'],
    source: 'openView',
  });
  // Another surface's selection is not this one's.
  set.mockClear();
  requestViewSelection('sess_b', 'later', selection);
  expect(set).not.toHaveBeenCalled();
});
