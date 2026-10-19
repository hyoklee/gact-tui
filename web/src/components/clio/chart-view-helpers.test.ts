import { describe, expect, it } from 'vitest';
import { chartAxisType, chartChannelField } from './chart-view-helpers';

describe('authored chart encodings', () => {
  const encoding = {
    x: { field: 'hour', type: 'ordinal' },
    y: { field: 'reading', type: 'quantitative', scale: { type: 'log' } },
    color: { field: 'statistic', type: 'nominal' },
  };

  it('finds fields and types in a custom spec with no duplicate component properties', () => {
    const spec = { mark: { type: 'line', point: true }, encoding };
    expect(chartChannelField(spec, 'x')).toBe('hour');
    expect(chartChannelField(spec, 'y')).toBe('reading');
    expect(chartChannelField(spec, 'color')).toBe('statistic');
    expect(chartAxisType(spec, 'x')).toBe('ordinal');
    expect(chartAxisType(spec, 'y')).toBe('quantitative');
  });

  it('handles shared and per-layer encodings and wrapped Altair facets', () => {
    for (const spec of [
      { encoding, layer: [{ mark: 'line' }, { mark: 'point' }] },
      {
        layer: [
          { mark: 'line', encoding },
          { mark: 'point', encoding },
        ],
      },
      { facet: { field: 'station' }, spec: { mark: 'point', encoding } },
    ]) {
      expect(chartChannelField(spec, 'x')).toBe('hour');
      expect(chartAxisType(spec, 'x')).toBe('ordinal');
    }
  });

  it('does not invent coordinates for ambiguous layers or separate plots', () => {
    const first = { mark: 'point', encoding };
    const other = { mark: 'point', encoding: { x: { field: 'distance', type: 'quantitative' } } };
    for (const spec of [{ layer: [first, other] }, { hconcat: [first, other] }]) {
      expect(chartChannelField(spec, 'x')).toBeUndefined();
      expect(chartAxisType(spec, 'x')).toBeUndefined();
    }
    expect(chartChannelField({ mark: 'rule', encoding: { x: { datum: 1 } } }, 'x')).toBeUndefined();
  });

  it('keeps observation coordinates when a constant reference line precedes data layers', () => {
    const spec = {
      layer: [
        { mark: 'rule', encoding: { y: { datum: 12.139, type: 'quantitative' } } },
        { mark: 'line', encoding },
        { mark: 'point', encoding },
      ],
    };
    expect(chartChannelField(spec, 'x')).toBe('hour');
    expect(chartChannelField(spec, 'y')).toBe('reading');
    expect(chartAxisType(spec, 'x')).toBe('ordinal');
    expect(chartAxisType(spec, 'y')).toBe('quantitative');
  });

  it('keeps point coordinates beside a field-valued reference rule', () => {
    const spec = { layer: [
      { mark: 'rule', transform: [{ filter: 'datum.year === 2024' }],
        encoding: { y: { field: 'historical_mean', type: 'quantitative' } } },
      { mark: 'point', encoding },
    ] };
    expect(chartChannelField(spec, 'x')).toBe('hour');
    expect(chartChannelField(spec, 'y')).toBe('reading');
    expect(chartAxisType(spec, 'y')).toBe('quantitative');
  });

  it('brushes observed points rather than their percentile band or median tick', () => {
    const spec = { encoding: { x: encoding.x }, layer: [
      { mark: 'rule', encoding: { y: { field: 'q25', type: 'quantitative' }, y2: { field: 'q75' } } },
      { mark: 'tick', encoding: { y: { field: 'median', type: 'quantitative' } } },
      { mark: 'point', encoding: { y: encoding.y } },
    ] };
    expect(chartChannelField(spec, 'x')).toBe('hour');
    expect(chartChannelField(spec, 'y')).toBe('reading');
    expect(chartAxisType(spec, 'x')).toBe('ordinal');
  });
});
