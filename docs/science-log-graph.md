# Science log relationship graph

The Science log offers Tree and Graph views over the same study. The graph shows
the recorded entry relationships, including hypotheses, observations, evidence,
conflicts and conclusion citations. Selecting a node opens its original entry
in the appropriate branch log. Returning to the tree preserves that selection.

Entire study shows all entries. Selected and linked shows the selected entry
and its direct incoming and outgoing relationships. Zoom and fit controls let
readers inspect larger studies. Missing reference targets remain visible as
unavailable entries. Relationship arrows retain the recorded direction. Cycles
are preserved, so the view does not assert that scientific reasoning is always
a DAG. Branch names remain attached to entries.

No server schema or scientific status is changed. The graph reuses the existing
entry-summary, status, citation and derivation readers, React Flow, Dagre and
the existing science status component.

## Validation

- Focused Vitest run: 14 passed across `study-graph.test.tsx` and the existing
  `science-log-tab.test.tsx`, with no skipped tests.
- `pnpm --filter @clio/workspace typecheck`: passed.
- Oxlint on all four changed production/test component files: passed with
  `--deny-warnings`.
- `git diff --check`: passed.
- Browser review of the production component: Tree/Graph switching, graph
  node selection opening the conflict record, and Selected and linked
  narrowing to four entries and three links worked.

The browser review used the explicitly labelled fixture under `web/tests/`.
It verifies rendering and interaction, not scientific acceptance on a fresh
agent investigation. Its screenshots were not added to the PI presentation.
The full workspace test suite and production build were not run.

The temporary review tab was closed. The owned local Vite preview and its
verified descendants were force-stopped after review; graceful settlement is
not claimed. The checkout and its installed dependencies are retained for
continued work on `codex/science-log-graph`.
