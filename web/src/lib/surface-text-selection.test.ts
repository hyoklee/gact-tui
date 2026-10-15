import { afterEach, expect, it } from 'vitest';
import { referenceSelectedText, surfaceTextSelection } from './surface-text-selection';

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

it('reads SVG text within one diagram and rejects a range reaching another surface', () => {
  document.body.innerHTML =
    '<section id="diagram"><svg><text>Alpha beta</text></svg></section><p>Other view</p>';
  const root = document.querySelector('#diagram')!;
  const range = document.createRange();
  range.setStart(root.querySelector('text')!.firstChild!, 6);
  range.setEnd(root.querySelector('text')!.firstChild!, 10);
  const selection = window.getSelection()!;
  selection.addRange(range);
  expect(surfaceTextSelection(root)).toBe('beta');
  range.setEnd(document.querySelector('p')!.firstChild!, 5);
  expect(surfaceTextSelection(root)).toBe('');
});

it('preserves view identity and explicitly carries the selected quotation', () => {
  const original = {
    title: 'Flowchart',
    summary: 'the whole diagram',
    markdown: 'Artifact: artifact://flow\nZone: the whole diagram',
    query: { dataUri: 'artifact://flow' },
  };
  const reference = referenceSelectedText(original, 'Chosen step\nThen next');
  expect(reference.summary).toBe('Selected text: Chosen step\nThen next');
  expect(reference.markdown).toContain('Artifact: artifact://flow');
  expect(reference.markdown).toContain('> Chosen step\n> Then next');
  expect(reference.query).toEqual({
    view: original.query,
    text_selection: { text: 'Chosen step\nThen next' },
  });
  expect(referenceSelectedText(original, '')).toBe(original);
});
