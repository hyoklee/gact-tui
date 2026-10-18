import { render as renderComponent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Mermaid } from './mermaid';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async () => ({ svg: '<svg viewBox="0 0 10 10"><text>Ready</text></svg>' })),
}));

vi.mock('mermaid', () => ({ default: mermaidMock }));
// Exercise the compatibility renderer's configuration separately from Pele.
vi.mock('@/components/clio/diagram-renderer', () => ({
  renderPeleDiagram: vi.fn(async () => undefined),
}));

describe('Mermaid renderer configuration', () => {
  it('retains an unchanged SVG subtree across parent callbacks so captures stay current', async () => {
    const chart = 'flowchart TD\n A --> B';
    const view = renderComponent(<Mermaid chart={chart} debounceTime={0} onSuccess={vi.fn()} />);
    await waitFor(() => expect(view.container.querySelector('[role="img"] > svg')).not.toBeNull());
    const svg = view.container.querySelector('[role="img"] > svg');
    view.rerender(<Mermaid chart={chart} debounceTime={0} onSuccess={vi.fn()} />);
    expect(view.container.querySelector('[role="img"] > svg')).toBe(svg);
  });
  it('disables HTML labels at the Mermaid 11 root configuration seam', async () => {
    renderComponent(
      <Mermaid
        chart={'flowchart TD\n  source[Scientific source] --> result[Result]'}
        config={{ flowchart: { htmlLabels: false }, htmlLabels: false }}
        debounceTime={0}
      />,
    );

    await waitFor(() => expect(mermaidMock.initialize).toHaveBeenCalled());

    expect(mermaidMock.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        htmlLabels: false,
        flowchart: expect.objectContaining({ htmlLabels: false }),
      }),
    );
  });
});
