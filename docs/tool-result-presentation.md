# Transcript results, not execution acknowledgements

The transcript should explain what the agent did, what it learned or changed,
and what is happening now. Technical details preserve maximum observability
without forcing the reader to decode JSON to understand the work.

Tools share one operation row in chat and Evidence. The row contains the action,
named links, consequential query/filter context and useful counts. Status marks
remain quiet; interruptions use an amber stop mark with the cause on hover.
Ordinary acknowledgements have no disclosure. Exact arguments and raw results
remain in the separate Technical details viewer.

`tool-operation-contract.ts` declares the semantic inputs of canonical operations
once. `toolOperation` composes those declarations with recorded blocks and exact
task identities. Shared assignment, returned-result, search and literal-data
readers handle the content; `ToolResultPresentation` retains the existing file,
terminal, resource, memory, question and media renderers. Add semantics to the
declaration or the owning adapter, not another per-tool viewer. Resource and
artifact links reuse workbench navigation. Unsupported URI schemes never become
executable links. The four obsolete tool aliases are omitted from this registry.

The row and expansion have separate responsibilities. The row explains the
operation and target. Expansion shows the actual assignment, message, match,
change or answer. Do not add mandatory Request/Result panels, Work paragraphs,
status recaps, link-opening instructions, decorative dot separators or em dashes.
Use spacing to separate metadata. Memory scope values are links to a filtered
memory list, rather than links to nonexistent documents.

Delegation shows the named assignment, recorded profile/model when available and
the assignment text. A wait names its selection and returned/running counts.
It cannot expand until a result or collection error exists. Returned task tabs
mount only the selected answer; pending tasks have no empty result panel. Search
titles carry the query and scope, while expansion contains named matches and
excerpts. Structured-only and third-party output uses a bounded literal table or
field reader. False, zero, null and empty strings remain distinguishable.

Task-result continuation uses the existing authorized result endpoint and the
receipt's immutable cursor. It verifies contiguous Unicode offsets and result
reference consistency, joins fragments before parsing and cancels on tab close.
It never replaces historical results with a child's current transcript. A
missing first fragment or changed reference is an explicit read failure.
Explicit failure fields of known web/command/submission schemas are interpreted
by their owning adapter; arbitrary provider status strings do not override the
recorded execution outcome.

Flow results reuse the existing flow card and its viewport-aware loader. A
conversation boundary that already owns the card disables a second inline flow
disclosure. Opening a plain tool row does not preload children or other sessions.

The repeatable browser review is `web/e2e/tool-operations.spec.ts`, included in
`web/playwright.components.config.ts`. It renders production chat components
with labelled synthetic data at desktop and phone widths, including long
assignments, reports, result tabs, searches and model lists. This checks
presentation and navigation; it is separate from running native agents and
qualifying the meaning of their work.

The `connected_data` link target opens trusted source setup. Its `uri` is the
owning CLIO identity, and `workspace_id` must match the surrounding conversation.
The renderer checks the currently connected CLIO before opening the shared picker;
changing endpoint or credentials closes the action. The link carries no browser
authorization URL, callback, token, or source-creation authority. Authentication
stays outside the tool observation; the agent reads approved status separately.

Presenters may declare a short `action` and a `subject` block ID. A text/link
subject is rendered in the action row: `Write filename`, `Read source`,
or `Delegate to assignment`. Operation declarations identify consequential input
fields; the renderer does not guess from arbitrary payload keys. Long links truncate within the available width; hover
and keyboard focus reveal the full identity, and declared links open normally.
Unknown or non-text/link subject IDs leave all result blocks visible. Existing
records retain their original blocks. Registered adapters may supply today's
action and subject placement during read-only projection; this never reruns a
tool, reads a file, or rewrites stored content. Unknown tools keep their labels.

Diff previews retain real unified-diff syntax, with semantic addition/deletion
backgrounds. The complete preview boundary remains visible when content is
clipped; a muted result surface separates effects from conversation prose without
putting a large card around every tool.

`BoundedResult` measures actual rendered text rectangles, including soft wraps.
The local Appearance setting defaults to five display lines (range 1–50); diffs
receive at most twice that budget, without padding short diffs. Show more reveals
the complete short result in one action; Show less restores its preview. Large or
paged results open a separate dialog and retrieve the remaining content cursors
there, keeping the transcript bounded. Closing the dialog cancels its outstanding
read. Controls preserve focus, expose expanded state, and announce expansion.

Technical details and full-result dialogs share `ResultDialogContent`. The title
and close control remain fixed; its keyboard-focusable ScrollArea owns vertical
overflow, with a visible scrollbar when content exceeds the viewport. Sections
must retain their natural height, never flex-shrink into an overflow-hidden clip.
Wide code uses a separately focusable horizontal scroll pane. Running terminal
viewports are keyboard-focusable too. Browser regressions cover a short window,
long arguments/results, and complete text, Markdown, code, diff, and terminal output.

File results show a single clickable basename that opens the workspace canvas;
full paths remain technical evidence. The row's right-aligned information button
opens a separate Technical details dialog, never an inline JSON wall. Todos use
empty pending boxes, amber in-progress dashes, and green completed checks. Their
preview shows three whole items rather than cutting wrapped task text in half.

Running terminals retain the command and use a scrolling line-budget viewport.
They follow output until the reader scrolls away. Completed output is replaced
by the final authoritative block, not appended again. Unicode-character offsets
match Python even when JavaScript uses two code units for a character.

Indexed todos expose task content and status. Child collection displays the
actual Markdown output rather than the serialized collection envelope. Longer
results remain expandable; acknowledgement summaries do not replace content.

Local validation covers geometry fixtures, paging, navigation, settings,
streaming, and the TUI declared-block renderer. Actual wrapping, streaming before
completion, and all required tool families still require live browser acceptance.

Reading position is user-owned. A canvas resize or streamed update cannot enable
follow-latest merely because layout temporarily puts the reader near the bottom.
Queued scroll frames re-check intent before moving the viewport; a width change
preserves the visible message and its offset. Keyboard, wheel, touch and native
scrollbar intent yield immediately, without a timed re-pin window. Latest is the
explicit way to resume following. Clipped checklist items are inert until expanded,
so their status tooltips cannot become invisible keyboard stops.
