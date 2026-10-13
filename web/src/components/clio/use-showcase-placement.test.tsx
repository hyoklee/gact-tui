import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useShowcasePlacement } from './use-showcase-placement';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it.each(['form', 'div'])('fits evidence beside a %s composer using its actual boundary', (tag) => {
  const surface = document.createElement('section');
  const transcript = document.createElement('div');
  transcript.dataset.slot = 'transcript-column';
  const composer = document.createElement(tag);
  composer.dataset.evidenceComposer = '';
  const button = document.createElement('button');
  surface.append(transcript, composer, button);
  document.body.append(surface);
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(new DOMRect(240, 40, 1680, 800));
  vi.spyOn(transcript, 'getBoundingClientRect').mockReturnValue(new DOMRect(570, 40, 896, 800));
  vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(new DOMRect(570, 720, 950, 104));
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(1800, 8, 32, 24));
  const { result } = renderHook(() =>
    useShowcasePlacement({ current: button }, { current: surface }),
  );
  act(() => {
    result.current.measureNow();
  });
  const gutter = result.current.gutter!;
  expect(gutter).toBeDefined();
  expect(gutter.left).toBeGreaterThan(composer.getBoundingClientRect().right);
  expect(gutter.left + gutter.width).toBeLessThan(surface.getBoundingClientRect().right);
  expect(gutter.width).toBeLessThan(480);
  expect(result.current.flyoutHeight).toBeLessThan(composer.getBoundingClientRect().top);
});
