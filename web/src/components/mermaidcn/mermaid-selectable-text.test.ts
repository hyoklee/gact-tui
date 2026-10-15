import { expect, it } from 'vitest';
import { mermaidSelectableText } from './mermaid-selectable-text';

it('keeps real SVG label coordinates and removes drawing/link content from the selection layer', () => {
  const output = mermaidSelectableText(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><g transform="translate(30,40)"><rect width="50" height="20"/><text x="5" y="10"><tspan>Chosen step</tspan></text></g><image href="https://example.test/image"/></svg>',
  );
  const root = new DOMParser().parseFromString(output, 'image/svg+xml').documentElement;
  expect(root.getAttribute('viewBox')).toBe('0 0 400 200');
  expect(root.querySelector('g')?.getAttribute('transform')).toBe('translate(30,40)');
  expect(root.querySelector('tspan')?.textContent).toBe('Chosen step');
  expect(root.querySelector('rect,image')).toBeNull();
  expect(root.querySelector('text')?.style.userSelect).toBe('text');
  expect(mermaidSelectableText('')).toBe('');
});
