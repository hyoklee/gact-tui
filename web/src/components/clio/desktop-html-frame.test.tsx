import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HtmlRendererFrame } from './desktop-html-frame';

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('reports an unavailable renderer instead of leaving a blank frame indefinitely', () => {
  vi.useFakeTimers();
  render(<HtmlRendererFrame name="sea.html" html="<h1>Sea</h1>" url="http://host/v1/html-renderer" />);
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(screen.getByText('Interactive preview did not respond')).toBeVisible();
  expect(screen.queryByTitle('HTML preview of sea.html')).toBeNull();
});

it('accepts readiness only from its own frame and sends the document once', () => {
  vi.useFakeTimers();
  render(<HtmlRendererFrame name="sea.html" html="<h1>Sea</h1>" url="http://host/v1/html-renderer" />);
  const frame = screen.getByTitle('HTML preview of sea.html') as HTMLIFrameElement;
  const post = vi.spyOn(frame.contentWindow!, 'postMessage');
  fireEvent.load(frame);
  fireEvent.load(frame);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith({ type: 'clio.html-preview', html: '<h1>Sea</h1>' }, '*');
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'clio.html-preview.ready' }, source: window }));
    vi.advanceTimersByTime(9_000);
  });
  expect(frame).toBeVisible();
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'clio.html-preview.ready' }, source: frame.contentWindow }));
    vi.advanceTimersByTime(10_000);
  });
  expect(frame).toBeVisible();
  expect(screen.queryByText('Interactive preview did not respond')).toBeNull();
});
