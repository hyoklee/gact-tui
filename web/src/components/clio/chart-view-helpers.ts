import type { ChartAxisType } from './chart-box-selection';
import type { ChartRow } from './chart-data';
import { isJsonObject } from './chart-spec-guard';

/** Vega stamps its own id onto each tuple, so it gets copies, never the data model's rows. */
export function cloneRows(rows: readonly ChartRow[]): ChartRow[] {
  return rows.map((row) => ({ ...row }));
}

function chartChannelDefinitions(
  spec: Record<string, unknown>,
  channel: string,
  inherited?: Record<string, unknown>,
): (Record<string, unknown> | undefined)[] {
  // Separate plots have separate coordinate systems. Do not guess which one
  // the user's brush is addressing from the first child in a concatenation.
  if (['concat', 'hconcat', 'vconcat', 'repeat'].some((key) => key in spec)) return [undefined];
  const definition = isJsonObject(spec.encoding) ? spec.encoding[channel] : undefined;
  const resolved = isJsonObject(definition) ? definition : inherited;
  if (Array.isArray(spec.layer)) {
    // Constant reference rules have no row coordinates. Their missing or
    // datum-only channels must not disable interaction on the data layers.
    const children = spec.layer.filter((child) => {
      if (!isJsonObject(child)) return true;
      const mark = isJsonObject(child.mark) ? child.mark.type : child.mark;
      const guides = isJsonObject(child.encoding) ? Object.values(child.encoding) : [];
      return mark !== 'rule' || guides.some((guide) => isJsonObject(guide) && 'field' in guide);
    });
    return children.flatMap((child) =>
      isJsonObject(child) ? chartChannelDefinitions(child, channel, resolved) : [undefined],
    );
  }
  if (isJsonObject(spec.spec)) return chartChannelDefinitions(spec.spec, channel, resolved);
  return [resolved];
}

/** Resolve an unambiguous authored encoding without requiring duplicate component fields. */
export function chartChannelField(
  spec: Record<string, unknown> | undefined,
  channel: 'x' | 'y' | 'color',
): string | undefined {
  if (!spec) return undefined;
  const fields = chartChannelDefinitions(spec, channel).map((definition) => definition?.field);
  if (!fields.length || fields.some((field) => typeof field !== 'string' || !field)) return;
  return new Set(fields).size === 1 ? (fields[0] as string) : undefined;
}

export function chartAxisType(
  spec: Record<string, unknown> | undefined,
  channel: 'x' | 'y',
): ChartAxisType | undefined {
  if (!spec) return undefined;
  const types = chartChannelDefinitions(spec, channel).map((definition) => definition?.type);
  if (!types.length || new Set(types).size !== 1) return undefined;
  const type = types[0];
  return type === 'quantitative' || type === 'temporal' || type === 'nominal' || type === 'ordinal'
    ? type
    : undefined;
}

export function isContinuousAxis(type: ChartAxisType | undefined): boolean {
  return type !== 'nominal' && type !== 'ordinal';
}

export function describeChart(
  spec: Record<string, unknown> | undefined,
  rows: readonly ChartRow[] | undefined,
  loading: boolean,
  note: string,
): string {
  if (loading) return 'Loading rows…';
  const summary = spec && typeof spec.description === 'string' ? spec.description : '';
  const count = rows ? `${rows.length.toLocaleString()} rows` : '';
  return [summary, count].filter(Boolean).join(' · ') || (note ? note : 'No rows');
}
