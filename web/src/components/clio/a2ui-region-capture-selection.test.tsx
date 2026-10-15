import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useContext, useRef } from 'react';
import { afterEach, expect, it } from 'vitest';
import { A2uiRegionCaptureContext, A2uiRegionCaptureProvider } from './a2ui-region-capture';

afterEach(() => {
  cleanup();
  window.getSelection()?.removeAllRanges();
});

it('clears native text selection when entering or toggling image-region mode', () => {
  function View() {
    const capture = useContext(A2uiRegionCaptureContext)!;
    const root = useRef<HTMLDivElement>(null);
    return (
      <div ref={root}>
        <p>Selected before image mode</p>
        <button
          onClick={() =>
            capture.start({ element: root.current!, title: 'Test visual', componentId: 'visual' })
          }
        >
          Image mode
        </button>
      </div>
    );
  }
  render(
    <A2uiRegionCaptureProvider allowDemoCapture surface={{ id: 'test', revision: 1, messages: [] }}>
      <View />
    </A2uiRegionCaptureProvider>,
  );
  const text = screen.getByText('Selected before image mode').firstChild!;
  for (let attempt = 0; attempt < 2; attempt++) {
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()!.addRange(range);
    expect(window.getSelection()!.isCollapsed).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Image mode' }));
    expect(window.getSelection()!.isCollapsed).toBe(true);
  }
});
