# Steering before the response that consumes it

The retained OPAL 1 export records the user's 17:55 steering message as consumed
by `msg_asst_e0b570ed055d`, after tool block
`live_call_8d2324449367_call`. The following `next_thought` text responds to that
question. The model received the steer, and the persisted receipt points to an
existing canonical block. The screenshots show the question below that reply
while the turn is live.

The UI's GACT reducer coalesced tool call/result blocks by invocation ID, but
replaced the first block with the result's different part ID and sequence. The
server's saved-message projection retains the first block. Live feedback
placement therefore could no longer find the server-recorded call anchor and
left the user message at the end of the assistant response.

The reducer now retains the first correlated tool block, matching the server
projection. Tool state, output and presentation continue to update through the
separate tool entity. Existing receipts and messages are not rewritten. Waiting
steers stay pending until the server reports consumption; this does not move an
unconsumed message ahead of work that has not received it.

Regression cases retain call identity/sequence, cover a result-only initial
block, and drive real transport frames through the reducer into the conversation
renderer. The rendered test first shows the pending human message, then completes
the tool, receives the delivery receipt and appends the reply. It requires the
human message to appear once before that reply and withholds a live completion
footer. The prior expectation that the result replaces the call ID is corrected;
no wire-order assertion is removed.

Hosted CI caught the added regression exceeding the conversation test file's
800-line limit. The complete live steering case and helper now live in
`conversation-live-steering.test.tsx`; their text and assertions are unchanged.
The original test file is back below the limit.

Local validation is source/diff inspection and Prettier only. No local test
suites, browser probes, app builds/reloads or inference were run. Hosted CI must
qualify this exact head before merging. The installed build is unchanged. This
change is in the UI repository's TypeScript SDK, not the clio-core repository or
installed Core package. The UI branch includes #611, #613 and #614 as dependencies.
