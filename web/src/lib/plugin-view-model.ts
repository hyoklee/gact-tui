import {
  A2UI_VERSION,
  type A2UISurface,
  type PluginViewComponent,
  type PluginViewEvent,
} from '@clio/core/v3';

/** One session in the tree a view's events may come from. */
export interface PluginViewSession {
  id: string;
  title: string;
  /** The session (or its task) is still working, so its events may change. */
  running?: boolean;
}

/** A plugin view merged from its events: what the catalog component draws now. */
export interface PluginView {
  /** `<plugin>/<name>`, as the events name it. */
  view: string;
  catalog: string;
  /** The latest component the view's events carried, or none yet. */
  component?: PluginViewComponent;
  /** The session that recorded that component, so its catalogs resolve it. */
  componentSession: string;
  /** Every item's latest rows, with `branch` set to its calling session's title. */
  rows: Record<string, unknown>[];
  /** How many items the rows cover. */
  items: number;
  /** The calling sessions, in first-seen order. */
  groups: string[];
  /** When the latest event was recorded (ISO time), or empty. */
  updatedAt: string;
}

/** A short, stable label for a session that has no title. */
export function shortSessionId(id: string): string {
  return id.replace(/^sess_/u, '').slice(-6) || id;
}

/** Replay order: recorded time, then each session's own transcript order. */
function compareEvents(left: PluginViewEvent, right: PluginViewEvent): number {
  if (left.at && right.at && left.at !== right.at) return left.at.localeCompare(right.at);
  if (left.session_id === right.session_id) return left.order - right.order;
  return (left.at || '').localeCompare(right.at || '') || left.order - right.order;
}

/**
 * Merge view events into views: per view, the latest component seen, and the
 * rows of the latest event for each item. An item is its `key` within its
 * calling session (`group`), so two sessions working on items with the same
 * key keep both. Each row's `branch` is set to the calling session's title.
 */
export function mergePluginViews(
  events: readonly PluginViewEvent[],
  titles: ReadonlyMap<string, string> = new Map(),
): PluginView[] {
  const ordered = [...events].sort(compareEvents);
  const views = new Map<
    string,
    {
      catalog: string;
      component?: PluginViewComponent;
      componentSession: string;
      items: Map<string, PluginViewEvent>;
      groups: string[];
      updatedAt: string;
    }
  >();
  for (const event of ordered) {
    let view = views.get(event.view);
    if (!view) {
      view = {
        catalog: event.catalog,
        componentSession: event.session_id,
        items: new Map(),
        groups: [],
        updatedAt: '',
      };
      views.set(event.view, view);
    }
    view.catalog = event.catalog;
    if (event.component) {
      view.component = event.component;
      view.componentSession = event.session_id;
    }
    const group = event.group || event.session_id;
    if (!view.groups.includes(group)) view.groups.push(group);
    const item = `${group}\u0000${event.key}`;
    // Re-inserting moves the item to the end, so rows follow update order.
    view.items.delete(item);
    view.items.set(item, event);
    if (event.at) view.updatedAt = event.at;
  }
  return [...views.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, view]) => ({
      view: name,
      catalog: view.catalog,
      component: view.component,
      componentSession: view.componentSession,
      rows: [...view.items.values()].flatMap((event) => {
        const group = event.group || event.session_id;
        const branch = titles.get(group) || shortSessionId(group);
        return event.rows.map((row) => ({ ...row, branch }));
      }),
      items: view.items.size,
      groups: view.groups,
      updatedAt: view.updatedAt,
    }));
}

/** A person-facing name for a view: its component's title, else its name. */
export function pluginViewTitle(view: Pick<PluginView, 'view' | 'component'>): string {
  if (view.component?.title) return view.component.title;
  const name = view.view.split('/').at(-1) || view.view;
  return name.charAt(0).toUpperCase() + name.slice(1).replaceAll(/[-_]/gu, ' ');
}

const WIRE_VERSION = `v${A2UI_VERSION}`;

/**
 * A view as a read-only A2UI surface of its plugin catalog: one component
 * (the catalog's own, with the spec its events carried) drawing the merged
 * rows inline. The catalog says which renderer kernel implements it, so the
 * chart, its spec guard and its data limits are the kernel's own.
 */
export function pluginViewSurface(view: PluginView, revision: number): A2UISurface | undefined {
  if (!view.component) return undefined;
  const surfaceId = `plugin-view-${view.view.replaceAll(/[^A-Za-z0-9_-]/gu, '-')}`;
  const component = { ...view.component, id: 'root', data: view.rows };
  return {
    id: surfaceId,
    session_id: view.componentSession,
    // One lifecycle per view: each revision updates the same surface in place.
    part_id: surfaceId,
    catalog_id: view.catalog,
    protocol_version: A2UI_VERSION,
    revision,
    state: 'ready',
    messages: [
      { version: WIRE_VERSION, createSurface: { surfaceId, catalogId: view.catalog } },
      { version: WIRE_VERSION, updateComponents: { surfaceId, components: [component] } },
    ],
    message_revisions: [1, revision],
  };
}
