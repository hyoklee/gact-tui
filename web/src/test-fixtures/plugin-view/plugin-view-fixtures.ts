import type { A2uiCatalogRow } from '@clio/core/v3';

/**
 * Recorded plugin view events as the `0.2` message read returns them: the
 * `hidden-law-bench` readings view, whose catalog component `Readings` is
 * implemented by the chart kernel with a fixed spec (marketplace
 * `hidden-law-bench/ai.iowarp.clio/a2ui/bench/readings_spec.json`).
 */
export const READINGS_CATALOG_ID = 'https://iowarp.ai/a2ui/catalogs/bench/v1';

export const READINGS_SPEC = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  data: { name: 'source' },
  transform: [
    {
      fold: ['arm_length_m', 'bob_mass_kg', 'release_angle_deg', 'ambient_temp_c'],
      as: ['input', 'setting'],
    },
  ],
  facet: { field: 'input', type: 'nominal', title: null },
  columns: 2,
  resolve: { scale: { x: 'independent' } },
  spec: {
    width: 260,
    height: 170,
    layer: [
      {
        mark: { type: 'point', filled: true, opacity: 0.75 },
        encoding: {
          x: { field: 'setting', type: 'quantitative', title: null },
          y: {
            field: 'period_s',
            type: 'quantitative',
            title: 'seconds per cycle',
            scale: { zero: false },
          },
          color: { field: 'branch', type: 'nominal', title: 'branch' },
        },
      },
      {
        // The plugin's shadow layer: the study's current law, in the view's units.
        transform: [
          {
            filter:
              "isValid(datum.shadow) && isFinite(datum.shadow) && (datum.shadow_of === 'ten_cycles_s' || datum.shadow_of === 'period_s')",
          },
          {
            calculate: "datum.shadow_of === 'ten_cycles_s' ? datum.shadow / 10 : datum.shadow",
            as: 'law_period_s',
          },
          { calculate: "'current law ' + split(datum.shadow_law, ':')[0]", as: 'law' },
        ],
        mark: { type: 'point', filled: false, strokeWidth: 1.5, size: 80 },
        encoding: {
          x: { field: 'setting', type: 'quantitative', title: null },
          y: {
            field: 'law_period_s',
            type: 'quantitative',
            title: 'seconds per cycle',
            scale: { zero: false },
          },
          color: { field: 'branch', type: 'nominal', title: 'branch' },
          shape: {
            field: 'law',
            type: 'nominal',
            title: 'shadow',
            scale: { range: ['diamond'] },
            legend: { labelLimit: 320 },
          },
        },
      },
    ],
  },
};

export const READINGS_COMPONENT = {
  id: 'readings',
  component: 'Readings',
  spec: READINGS_SPEC,
  title: 'Bench readings',
};

/** The plugin catalog row a session with the plugin lists (`/a2ui/catalogs`). */
export const READINGS_CATALOG_ROW: A2uiCatalogRow = {
  catalogId: READINGS_CATALOG_ID,
  protocolVersion: '0.9.1',
  source: 'plugin',
  checksum: 'fixture',
  componentNames: ['Readings'],
  functionNames: [],
  sidecar: {
    catalogId: READINGS_CATALOG_ID,
    protocolVersion: '0.9.1',
    trust: { source: 'pack' },
    implements: { Readings: { kernel: 'clio.chart.v1' } },
  },
  producible: true,
  file: { catalogId: READINGS_CATALOG_ID, components: { Readings: {} } },
};

export function reading(index: number, branchSession: string, period: number) {
  return {
    reading: index,
    arm_length_m: 0.5 + index / 10,
    bob_mass_kg: 0.2,
    release_angle_deg: 10,
    ambient_temp_c: 20,
    ten_cycles_s: period * 10,
    period_s: period,
    branch: branchSession,
  };
}

/** One `tool_result` part carrying a view event, as recorded live. */
export function viewPart(
  callId: string,
  event: {
    key: string;
    group: string;
    rows: Record<string, unknown>[];
    component?: Record<string, unknown>;
    view?: string;
  },
  completedAt: string,
) {
  return {
    id: `live_${callId}_result`,
    type: 'tool_result',
    call_id: callId,
    tool_name: 'measure',
    metadata: {
      stream_source: 'live',
      completed_at: completedAt,
      ui_event: {
        view: event.view ?? 'hidden-law-bench/readings',
        catalog: READINGS_CATALOG_ID,
        key: event.key,
        group: event.group,
        rows: event.rows,
        ...(event.component ? { component: event.component } : {}),
      },
    },
  };
}

/** A recorded assistant message holding `parts`. */
export function recordedMessage(
  id: string,
  sessionId: string,
  createdAt: string,
  parts: unknown[],
) {
  return { id, session_id: sessionId, role: 'assistant', created_at: createdAt, parts };
}
