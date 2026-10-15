import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWPORT_HEIGHT,
  MIN_VIEWPORT_HEIGHT,
  clampViewportHeight,
  initialViewportHeight,
  maxViewportHeight,
  persistViewportHeight,
  readPersistedViewportHeight,
} from './a2ui-response-viewport-resize';

afterEach(() => {
  window.sessionStorage.clear();
});

describe('maxViewportHeight', () => {
  it('reserves composer and header space within the 85% limit', () => {
    expect(maxViewportHeight(1000)).toBe(728);
    expect(maxViewportHeight(720)).toBe(448);
  });

  it('allows a smaller tray when a short window cannot fit the normal minimum', () => {
    expect(maxViewportHeight(400)).toBe(128);
  });
});

describe('clampViewportHeight', () => {
  it('leaves an in-range height untouched', () => {
    expect(clampViewportHeight(500, 1000)).toBe(500);
  });

  it('floors at the minimum', () => {
    expect(clampViewportHeight(10, 1000)).toBe(MIN_VIEWPORT_HEIGHT);
  });

  it('ceilings at the available height and keeps short-window resizing possible', () => {
    expect(clampViewportHeight(5000, 1000)).toBe(728);
    expect(clampViewportHeight(10, 400)).toBe(128);
  });
});

describe('viewport height persistence', () => {
  it('round-trips a persisted height for a surface id', () => {
    persistViewportHeight('surface_1', 600);
    expect(readPersistedViewportHeight('surface_1')).toBe(600);
  });

  it('keeps different surfaces independent', () => {
    persistViewportHeight('surface_1', 600);
    persistViewportHeight('surface_2', 300);
    expect(readPersistedViewportHeight('surface_1')).toBe(600);
    expect(readPersistedViewportHeight('surface_2')).toBe(300);
  });

  it('reports no persisted height for an unseen surface', () => {
    expect(readPersistedViewportHeight('never_resized')).toBeUndefined();
  });

  it('falls back to the default height, clamped, when nothing is persisted', () => {
    expect(initialViewportHeight('fresh_surface', 1000)).toBe(DEFAULT_VIEWPORT_HEIGHT);
    expect(initialViewportHeight('fresh_surface', 400)).toBe(maxViewportHeight(400));
    expect(initialViewportHeight('fresh_surface', 720)).toBe(352);
    expect(initialViewportHeight('fresh_surface', 720)).toBeLessThan(maxViewportHeight(720));
  });

  it('uses the persisted height, clamped to the current window, once one exists', () => {
    persistViewportHeight('surface_3', 700);
    expect(initialViewportHeight('surface_3', 1000)).toBe(700);
    expect(initialViewportHeight('surface_3', 400)).toBe(maxViewportHeight(400));
  });
});
