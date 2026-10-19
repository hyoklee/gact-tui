import type { Spec, View } from 'vega';

export interface ChartSize {
  width: number;
  height: number;
  fillHeight?: boolean;
}

/** Find constant plot dimensions, without changing scale domains or parameters. */
function plotSizeSignals(spec: Spec, dimension: 'width' | 'height'): string[] {
  const references = new Set<string>();
  const visit = (marks: Spec['marks']) => {
    for (const mark of marks ?? []) {
      if (mark.type !== 'group') continue;
      const size = mark.encode?.update?.[dimension];
      if (size && !Array.isArray(size) && 'signal' in size) {
        // Expressions and group-local widths are derived by Vega. Only root
        // constants directly used as a plot's width are safe layout inputs.
        references.add(size.signal);
      }
      visit(mark.marks);
    }
  };
  visit(spec.marks);
  return [
    ...(references.has(dimension) && Number(spec[dimension]) > 0 ? [dimension] : []),
    ...(spec.signals ?? [])
      .filter(
        (signal) =>
          references.has(signal.name) &&
          'value' in signal &&
          typeof signal.value === 'number' &&
          signal.value > 0,
      )
      .map((signal) => signal.name),
  ];
}

/** Measure axes, legends, spacing and panels together, in Vega's actual layout coordinates. */
function renderedSize(view: View, dimension: 'width' | 'height'): number {
  // Vega returns a Scenegraph here; its published typings incorrectly call
  // that object a Scene. The real renderer and the headless tests use root.
  const graph = view.scenegraph() as unknown as {
    root: { bounds: { x1: number; x2: number; y1: number; y2: number } };
  };
  const bounds = graph.root.bounds;
  const padding = view.padding();
  return (
    Math.ceil(
      dimension === 'width'
        ? Math.max(view.width(), bounds.x2) - Math.min(0, bounds.x1)
        : Math.max(view.height(), bounds.y2) - Math.min(0, bounds.y1),
    ) +
    (typeof padding === 'number'
      ? 2 * padding
      : dimension === 'width'
        ? (padding.left ?? 0) + (padding.right ?? 0)
        : (padding.top ?? 0) + (padding.bottom ?? 0))
  );
}

/**
 * Fit the live view, including compositions that Vega-Lite's `autosize: fit`
 * explicitly does not support. Change plot dimensions in place: row identity,
 * authored domains, user selections and parameter values survive a resize.
 * Composed panel heights stay readable inline and fill the fullscreen viewer.
 * Step-sized discrete plots retain scrolling.
 */
export async function resizeChartView(
  view: View,
  compiled: Spec,
  size: ChartSize,
  cancelled: () => boolean = () => false,
): Promise<void> {
  if (cancelled() || size.width <= 0) return;
  if (!compiled.layout) {
    await view.width(size.width).height(size.height).resize().runAsync();
    return;
  }
  const dimensions = {
    width: plotSizeSignals(compiled, 'width'),
    height: size.fillHeight ? plotSizeSignals(compiled, 'height') : [],
  };
  // Axes and titles consume fixed space, so a one-off proportional scaling
  // leaves an error. Re-evaluate the real layout after each bounded correction.
  for (let pass = 0; pass < 8 && !cancelled(); pass += 1) {
    let changed = false;
    for (const dimension of ['width', 'height'] as const) {
      const outer = renderedSize(view, dimension);
      if (!Number.isFinite(outer) || outer <= 0 || Math.abs(outer - size[dimension]) <= 2) continue;
      const ratio = size[dimension] / outer;
      for (const name of dimensions[dimension]) {
        const current = name === dimension ? view[dimension]() : Number(view.signal(name));
        // Multiple panels may need scrolling on a phone. Keep every panel
        // readable rather than hiding observations to eliminate overflow.
        const next = Math.max(120, current * ratio);
        if (Math.abs(next - current) < 0.25) continue;
        if (name === dimension) view[dimension](next);
        else view.signal(name, next);
        changed = true;
      }
    }
    if (!changed) return;
    await view.resize().runAsync();
  }
}
