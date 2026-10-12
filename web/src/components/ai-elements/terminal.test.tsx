import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveAnsiComponent, Terminal, TerminalContent } from './terminal';

afterEach(cleanup);

describe('resolveAnsiComponent', () => {
  const Renderer = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

  it('preserves a direct component export', () => {
    expect(resolveAnsiComponent(Renderer)).toBe(Renderer);
  });

  it('unwraps the CommonJS default shape returned by the browser bundle', () => {
    expect(resolveAnsiComponent({ default: Renderer })).toBe(Renderer);
    expect(resolveAnsiComponent({ default: { default: Renderer } })).toBe(Renderer);
  });

  it('rejects a package shape without a component', () => {
    expect(() => resolveAnsiComponent({ default: {} })).toThrow(
      'ansi-to-react did not resolve to a React component',
    );
  });

  it('shows an exact command above the output', () => {
    render(<Terminal command={'printf "first\\nsecond\\n"'} output={'first\nsecond\n'} />);

    expect(screen.getByLabelText('Command')).toHaveTextContent('printf "first\\nsecond\\n"');
    expect(screen.getByText(/first\s+second/u)).toBeVisible();
  });

  it('renders a recorded output page inside the same terminal surface', () => {
    render(
      <Terminal output="head excerpt">
        <TerminalContent output="tail excerpt" />
      </Terminal>,
    );
    expect(screen.getByText('tail excerpt')).toBeVisible();
    expect(screen.queryByText('head excerpt')).not.toBeInTheDocument();
  });
});
