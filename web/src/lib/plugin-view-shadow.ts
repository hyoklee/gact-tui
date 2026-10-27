import type { ScienceEntry } from '@clio/core/v3';
import { evaluateFormula, parseFormula, type Formula } from './formula-expression';
import type { PluginView } from './plugin-view-model';

/**
 * A study's current law drawn beside a view's rows (its "shadow"): the most
 * recent hypothesis whose `formula` parses, whose status still stands, and
 * whose names are numeric fields of the view's rows. Each row then carries the
 * law's value for it, so a view that draws `shadow` shows a wrong law drifting
 * away from the measured values and a right one settling onto them.
 */

/** A hypothesis status that no longer stands as the study's law. */
const SET_ASIDE = new Set(['refuted', 'superseded', 'withdrawn']);

/** Longest label a row carries for its law. Unit: characters. */
const LABEL_LENGTH = 72;

export interface CurrentLaw {
  /** The hypothesis entry id. */
  id: string;
  /** A short label: the hypothesis's title, name or claim, shortened. */
  label: string;
  /** The formula text as written. */
  text: string;
  formula: Formula;
}

/** What a row gains when a law applies to it. */
export interface ShadowFields {
  /** The law's value for the row. */
  shadow: number;
  /** The field the law predicts (its left side). */
  shadow_of: string;
  /** `<hypothesis id>: <short label>`; a chart's rows hold plain values only. */
  shadow_law: string;
}

/** The view's current law and how many of its rows it was drawn for. */
export interface PluginViewShadow {
  law: CurrentLaw;
  rows: number;
}

function shorten(value: string, length: number): string {
  const text = value.replaceAll(/\s+/gu, ' ').trim();
  if (text.length <= length) return text;
  const cut = text.slice(0, length - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function lawLabel(entry: ScienceEntry, formula: string): string {
  for (const key of ['title', 'name', 'claim']) {
    const value = entry.fields[key];
    if (typeof value === 'string' && value.trim()) return shorten(value, LABEL_LENGTH);
  }
  return shorten(formula, LABEL_LENGTH);
}

/**
 * The fields that hold a finite number in at least one row and nothing but
 * numbers (or no value) in every other row.
 */
export function numericFields(rows: readonly Record<string, unknown>[]): Set<string> {
  const numeric = new Set<string>();
  const mixed = new Set<string>();
  for (const row of rows)
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'number' && Number.isFinite(value)) numeric.add(key);
      else mixed.add(key);
    }
  for (const key of mixed) numeric.delete(key);
  return numeric;
}

function newestFirst(entries: readonly ScienceEntry[]): ScienceEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (left, right) =>
        right.entry.created_at.localeCompare(left.entry.created_at) || right.index - left.index,
    )
    .map(({ entry }) => entry);
}

/**
 * The study's current law for these rows: the most recent hypothesis whose
 * formula parses, whose status is not refuted, superseded or withdrawn, whose
 * left side names a numeric row field and whose right side reads only numeric
 * row fields. `undefined` when no hypothesis qualifies.
 */
export function currentLaw(
  entries: readonly ScienceEntry[],
  rows: readonly Record<string, unknown>[],
): CurrentLaw | undefined {
  if (!rows.length) return undefined;
  const fields = numericFields(rows);
  for (const entry of newestFirst(entries)) {
    if (entry.type !== 'hypothesis' || SET_ASIDE.has(entry.status.trim())) continue;
    const text = entry.fields['formula'];
    if (typeof text !== 'string') continue;
    const parsed = parseFormula(text);
    if (!parsed.ok) continue;
    const { formula } = parsed;
    if (!fields.has(formula.target) || !formula.names.every((name) => fields.has(name))) continue;
    return { id: entry.id, label: lawLabel(entry, text), text: text.trim(), formula };
  }
  return undefined;
}

/** The law's value for one row, or `undefined` when a name it reads has no number there. */
export function shadowValue(law: CurrentLaw, row: Record<string, unknown>): number | undefined {
  const values: Record<string, number> = {};
  for (const name of law.formula.names) {
    const value = row[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    values[name] = value;
  }
  return evaluateFormula(law.formula.expression, values);
}

/**
 * Each view with its study's current law: rows the law evaluates on gain
 * `shadow`, `shadow_of` and `shadow_law`, and the view records which law it
 * drew. A view no law applies to is returned unchanged.
 */
export function withCurrentLaw(
  views: readonly PluginView[],
  entries: readonly ScienceEntry[],
): PluginView[] {
  if (!entries.length) return [...views];
  return views.map((view) => {
    const law = currentLaw(entries, view.rows);
    if (!law) return view;
    let drawn = 0;
    const rows = view.rows.map((row) => {
      const shadow = shadowValue(law, row);
      if (shadow === undefined) return row;
      drawn += 1;
      const fields: ShadowFields = {
        shadow,
        shadow_of: law.formula.target,
        shadow_law: `${law.id}: ${law.label}`,
      };
      return { ...row, ...fields };
    });
    return drawn ? { ...view, rows, shadow: { law, rows: drawn } } : view;
  });
}
