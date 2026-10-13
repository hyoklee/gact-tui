import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { QuestionMarkdown } from './question-markdown';

afterEach(cleanup);

it('renders emphasis, code, math and navigable links in question text', async () => {
  const { container } = render(
    <QuestionMarkdown>
      {
        'Compare **control** using `leaf_area`. The change is \\(\\Delta A\\). Read [the guide](https://example.org/guide).'
      }
    </QuestionMarkdown>,
  );
  expect(await screen.findByText('control')).toHaveProperty('tagName', 'STRONG');
  expect(screen.getByText('leaf_area')).toHaveProperty('tagName', 'CODE');
  expect(await screen.findByRole('link', { name: 'the guide' })).toHaveAttribute(
    'href',
    'https://example.org/guide',
  );
  expect(container.querySelector('.katex')).not.toBeNull();
  expect(container.textContent).not.toContain('**control**');
});
