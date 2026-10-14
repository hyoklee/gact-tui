import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { parseMathMarkdownBlocks } from '@/lib/remark-standard-math';
import { MarkdownText } from './markdown';

afterEach(cleanup);

describe('real Markdown math renderer', () => {
  for (const mode of ['static', 'streaming'] as const) {
    it(`renders standard delimiters and existing dollar math in ${mode} messages`, async () => {
      const { container } = render(
        <MarkdownText mode={mode}>
          {String.raw`Velocity \(\mathbf{u}\) and density \(\rho\).

\[
\rho\left(\frac{\partial \mathbf{u}}{\partial t} + (\mathbf{u}\cdot\nabla)\mathbf{u}\right) = -\nabla p + \mu\nabla^2\mathbf{u} + \mathbf{f}
\]

\[\nabla\cdot\mathbf{u}=0\]

Existing $$x^2$$.

$$
E = mc^2
$$`}
        </MarkdownText>,
      );
      await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(6));
      expect(container.querySelectorAll('.katex-display')).toHaveLength(3);
      expect(container.querySelector('.katex-error')).toBeNull();
      expect(container.querySelector('annotation')?.textContent).toBe(String.raw`\mathbf{u}`);
    });
  }

  it('preserves code, escaped delimiters, links and single-dollar currency', async () => {
    const { container } = render(
      <MarkdownText mode="static">
        {'Cost: $20 and $30. Literal `\\(x^2\\)`.\n' +
          String.raw`

\\(literal\\) and [reference](https://example.com/a).

~~~tex
\[x^2\]
~~~

    \(indented\)

\(a_* < b_2\)`}
      </MarkdownText>,
    );
    await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(1));
    expect(container.textContent).toContain('$20 and $30');
    expect(container.textContent).toContain(String.raw`\(literal\)`);
    expect(container.querySelector('a')).toHaveAttribute('href', 'https://example.com/a');
    expect(container.querySelector('annotation')?.textContent).toBe('a_* < b_2');
    expect(container.textContent).toContain(String.raw`\[x^2\]`);
    expect(container.textContent).toContain(String.raw`\(indented\)`);
  });

  it('does not invent a closing delimiter while streaming and recovers on completion', async () => {
    const { container, rerender } = render(
      <MarkdownText isAnimating>{String.raw`Before \(x^2`}</MarkdownText>,
    );
    expect(container.querySelector('.katex')).toBeNull();
    rerender(<MarkdownText>{String.raw`Before \(x^2\). After.`}</MarkdownText>);
    await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(1));
    expect(container.textContent).toContain('After.');
  });

  it('keeps blank lines and TeX line breaks inside one display block', async () => {
    const equation = String.raw`\[
\begin{aligned}
x &= 1 \\

y &= 2
\end{aligned}
\]`;
    const blocks = parseMathMarkdownBlocks(`Before.\n\n${equation}\n\nAfter.`);
    expect(blocks.some((block) => block.includes(equation))).toBe(true);
    const { container } = render(<MarkdownText>{`Before.\n\n${equation}\n\nAfter.`}</MarkdownText>);
    await waitFor(() => expect(container.querySelectorAll('.katex-display')).toHaveLength(1));
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.textContent).toContain('After.');
  });

  it('renders math in lists, quotes, links and tables without changing their structure', async () => {
    const { container } = render(
      <MarkdownText mode="static">
        {String.raw`- Measured \(x_1\).
- Other \(x_2\).

> Compare \(y\).

[\(z\)](https://example.com/math)

| Variable | Value |
| --- | --- |
| \(q\) | 1 |`}
      </MarkdownText>,
    );
    await waitFor(() => expect(container.querySelectorAll('.katex')).toHaveLength(5));
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('blockquote .katex')).not.toBeNull();
    expect(container.querySelector('a .katex')).not.toBeNull();
    expect(container.querySelector('table .katex')).not.toBeNull();
  });

  it('leaves unmatched and empty delimiters as ordinary text', () => {
    const { container } = render(
      <MarkdownText mode="static">{String.raw`\(\) \[ \] \(unfinished and \[also unfinished`}</MarkdownText>,
    );
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.textContent).toContain('unfinished');
  });

  it('renders display delimiters embedded in prose and accepts trailing whitespace', async () => {
    const { container } = render(
      <MarkdownText>
        {'Before \\[x_1=2\\] after.\n\n\\[\r\nx=1\r\n\\]  \r\n\r\nLast.'}
      </MarkdownText>,
    );
    await waitFor(() => expect(container.querySelectorAll('.katex-display')).toHaveLength(2));
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.textContent).toContain('after.');
    expect(container.textContent).toContain('Last.');
  });
});
