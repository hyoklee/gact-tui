import type { ScienceEntry } from '@clio/core/v3';
import { describe, expect, it } from 'vitest';
import type { PluginView } from './plugin-view-model';
import { currentLaw, numericFields, withCurrentLaw } from './plugin-view-shadow';

function hypothesis(
  id: string,
  formula: unknown,
  { status = 'open', at = '2026-10-27T10:00:00Z', claim = `Claim of ${id}` } = {},
): ScienceEntry {
  return {
    id,
    study: 'study',
    branch: 'sess_root',
    session: 'sess_root',
    type: 'hypothesis',
    fields: { claim, formula },
    links: [],
    status,
    created_at: at,
    invocation: '',
  } as ScienceEntry;
}

const rows = [
  { reading: 1, x_len: 1, x_temp: 20, y_total: 20.1, y_unit: 2.01, label: 'a', branch: 'Root' },
  { reading: 2, x_len: 2, x_temp: 30, y_total: 31.0, y_unit: 3.1, label: 'b', branch: 'Root' },
];

function view(viewRows: Record<string, unknown>[] = rows): PluginView {
  return {
    view: 'some-plugin/measurements',
    catalog: 'https://example.test/catalog',
    componentSession: 'sess_root',
    rows: viewRows,
    items: viewRows.length,
    groups: ['sess_root'],
    updatedAt: '',
  };
}

describe('a view’s current law', () => {
  it('knows which row fields are numeric', () => {
    expect([...numericFields([...rows, { x_len: null, reading: 'n/a' }])].sort()).toEqual([
      'x_len',
      'x_temp',
      'y_total',
      'y_unit',
    ]);
  });

  it('takes the most recent standing hypothesis written in the rows’ numeric fields', () => {
    const entries = [
      hypothesis('e_old', 'y_total = 20 * x_len^0.5', { at: '2026-10-27T10:00:00Z' }),
      hypothesis('e_new', 'y_total = 20.4 * x_len^0.59', { at: '2026-10-27T10:05:00Z' }),
      // Newer, but each is set aside for its own reason.
      hypothesis('e_refuted', 'y_total = 1', { status: 'refuted', at: '2026-10-27T10:06:00Z' }),
      hypothesis('e_super', 'y_total = 2', { status: 'superseded', at: '2026-10-27T10:07:00Z' }),
      hypothesis('e_gone', 'y_total = 3', { status: 'withdrawn', at: '2026-10-27T10:08:00Z' }),
      hypothesis('e_words', 'T = 2*pi*sqrt(L/g)', { at: '2026-10-27T10:09:00Z' }),
      hypothesis('e_broken', 'y_total = sin(x_len)', { at: '2026-10-27T10:10:00Z' }),
      hypothesis('e_text', 'y_total = label * 2', { at: '2026-10-27T10:11:00Z' }),
      hypothesis('e_target', 'label = x_len', { at: '2026-10-27T10:12:00Z' }),
      hypothesis('e_none', undefined, { at: '2026-10-27T10:13:00Z' }),
      hypothesis('e_number', 42, { at: '2026-10-27T10:14:00Z' }),
      { ...hypothesis('e_other', 'y_total = 9'), type: 'observation' } as ScienceEntry,
    ];
    const law = currentLaw(entries, rows);
    expect(law?.id).toBe('e_new');
    expect(law?.formula.target).toBe('y_total');
    expect(law?.label).toBe('Claim of e_new');
  });

  it('breaks a tie in time by log order, and has no law without rows or entries', () => {
    const entries = [hypothesis('e_first', 'y_unit = x_len'), hypothesis('e_second', 'y_unit = 2')];
    expect(currentLaw(entries, rows)?.id).toBe('e_second');
    expect(currentLaw(entries, [])).toBeUndefined();
    expect(currentLaw([], rows)).toBeUndefined();
  });

  it('labels a hypothesis by its claim, shortened, or else by its formula', () => {
    const long = `A law ${'that goes on '.repeat(12)}and on`;
    const named = currentLaw([hypothesis('e_long', 'y_unit = x_len', { claim: long })], rows);
    expect(named!.label.length).toBeLessThanOrEqual(72);
    expect(named!.label.endsWith('…')).toBe(true);
    const bare = currentLaw([hypothesis('e_bare', 'y_unit = x_len', { claim: '' })], rows);
    expect(bare!.label).toBe('y_unit = x_len');
  });
});

describe('rows gaining the shadow', () => {
  it('adds shadow, shadow_of and shadow_law to each row the law evaluates on', () => {
    const entries = [
      hypothesis('e_law', 'y_total = 20 * x_len^0.5 * sqrt(1 + max(0, x_temp - 25))'),
    ];
    const [shadowed] = withCurrentLaw([view()], entries);
    expect(shadowed!.shadow).toMatchObject({ law: { id: 'e_law' }, rows: 2 });
    expect(shadowed!.rows[0]).toEqual({
      ...rows[0],
      shadow: 20,
      shadow_of: 'y_total',
      shadow_law: 'e_law: Claim of e_law',
    });
    expect(shadowed!.rows[1]!.shadow).toBeCloseTo(20 * Math.sqrt(2) * Math.sqrt(6), 10);
  });

  it('leaves a row the law has no value for as it was', () => {
    const viewRows = [...rows, { reading: 3, x_len: -1, x_temp: 20, y_total: 1 }];
    const [shadowed] = withCurrentLaw(
      [view(viewRows)],
      [hypothesis('e_root', 'y_total = sqrt(x_len)')],
    );
    expect(shadowed!.shadow?.rows).toBe(2);
    expect(shadowed!.rows[2]).toBe(viewRows[2]);
  });

  it('leaves a view unchanged when no law applies', () => {
    const plain = view();
    expect(withCurrentLaw([plain], [])[0]).toBe(plain);
    expect(withCurrentLaw([plain], [hypothesis('e_x', 'T = 2*pi*sqrt(L/g)')])[0]).toBe(plain);
    expect(
      withCurrentLaw([plain], [hypothesis('e_x', 'y_total = x_len', { status: 'refuted' })])[0],
    ).toBe(plain);
  });

  it('redraws when the law changes, so the shadow drifts or settles', () => {
    const wrong = [hypothesis('e_wrong', 'y_unit = 2 * x_len', { at: '2026-10-27T10:00:00Z' })];
    const right = [
      { ...wrong[0]!, status: 'refuted' },
      hypothesis('e_right', 'y_unit = y_total / 10', { at: '2026-10-27T10:05:00Z' }),
    ];
    const [before] = withCurrentLaw([view()], wrong);
    const [after] = withCurrentLaw([view()], right);
    const gap = (shadowed: PluginView) =>
      shadowed.rows.map((row) => Math.abs((row.shadow as number) - (row.y_unit as number)));
    expect(before!.shadow?.law.id).toBe('e_wrong');
    expect(Math.max(...gap(before!))).toBeGreaterThan(0.5);
    expect(after!.shadow?.law.id).toBe('e_right');
    expect(Math.max(...gap(after!))).toBeLessThan(1e-9);
  });
});
