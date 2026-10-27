import { scienceLogSchema, type ScienceStudy } from '@clio/core/v3';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudyViews } from './study-views';

vi.mock('@/lib/a2ui/processor-store', () => ({ useA2uiSessionRegistry: vi.fn() }));
vi.mock('./a2ui-surface', () => ({
  ClioA2UISurface: ({ surface, readOnly }: { surface: { id: string }; readOnly?: boolean }) => (
    <p data-read-only={String(Boolean(readOnly))}>surface {surface.id}</p>
  ),
}));

afterEach(cleanup);

const surface = (id: string, sessionId: string) => ({
  id,
  session_id: sessionId,
  catalog_id: 'https://iowarp.ai/a2ui/catalogs/clio-workspace/v1',
  protocol_version: '0.9.1',
  revision: 3,
  state: 'ready',
  messages: [],
});

function study(views: unknown[]): ScienceStudy {
  return scienceLogSchema.parse({
    session_id: 'sess_root',
    in_study: true,
    study: 'e_1',
    root_session_id: 'sess_root',
    branches: [
      { session_id: 'sess_root', title: 'Solver study', relation: 'root' },
      { session_id: 'sess_b', title: 'Entropy branch', relation: 'step' },
    ],
    entries: [],
    views,
  }) as ScienceStudy;
}

const view = (entry: string, sessionId: string, extra: Record<string, unknown> = {}) => ({
  entry,
  session_id: sessionId,
  surface_id: `surface_${entry}`,
  title: `Title ${entry}`,
  purpose: `Purpose ${entry}`,
  serves: ['e_1'],
  created_at: '2026-10-27T10:00:00Z',
  surface: surface(`surface_${entry}`, sessionId),
  ...extra,
});

describe('Study views', () => {
  it("draws each attached view as its owner's surface, with its title, purpose and owner", () => {
    render(<StudyViews study={study([view('e_v1', 'sess_root'), view('e_v2', 'sess_b')])} />);
    const [overview, drill] = screen.getAllByRole('region');
    expect(within(overview!).getByRole('heading', { name: 'Title e_v1' })).toBeVisible();
    expect(within(overview!).getByText('Purpose e_v1')).toBeVisible();
    expect(within(overview!).getByText('Attached by the study')).toBeVisible();
    expect(within(overview!).getByText('surface surface_e_v1')).toBeVisible();
    expect(within(drill!).getByText('Attached by Entropy branch')).toBeVisible();
    expect(within(drill!).getByText('surface surface_e_v2')).toHaveAttribute(
      'data-read-only',
      'false',
    );
  });

  it('says in words when the owner deleted the surface, or it cannot be read', () => {
    render(
      <StudyViews
        readOnly
        study={study([
          view('e_v1', 'sess_root', { surface: null, reason: 'view_surface_deleted' }),
          view('e_v2', 'sess_b', { surface: { id: 'broken' } }),
        ])}
      />,
    );
    expect(screen.getByText(/has since deleted its dashboard/u)).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent("This view's dashboard could not be read.");
  });
});
