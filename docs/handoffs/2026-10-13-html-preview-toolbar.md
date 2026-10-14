# One HTML viewer toolbar

The file shell already owned Preview and file actions, but the HTML renderer
added another filename/Preview/Source row and a permanent static-preview notice.
The user's screenshot consequently had three rows above the HTML content,
besides the canvas tab naming the file.

Workspace HTML files and uploads now place Preview and Source in the existing
file toolbar beside its actions. Embedded HTML renderers contribute only their
selected view, so the filename/header is not repeated below that toolbar.
Standalone HTML previews retain their own navigation when no file host owns it.
The permanent notice is removed from every HTML preview.

Preview and Source reuse the loaded content. Switching workspace HTML tabs does
not refetch the file; uploads keep their existing shared query. Source shows and
copies the original text. The opaque iframe, sanitizer and no-external-resource
policy are unchanged.

Existing sanitization and exact-source cases remain, with added assertions that
workspace/upload view controls share one toolbar and switching tabs reads once.
Changing from HTML Source to a non-HTML upload falls back to Preview, with a
rerender regression covering that navigation.
Hosted narrow/wide workspace browser cases check the content starts immediately
below that toolbar, both views work and source bytes remain unexecuted.

Local validation is source/diff inspection and Prettier only. No local test suite,
browser probe, screenshot, app build/reload or inference was run. Hosted CI must
qualify the exact head before merge. The installed app remains unchanged. This
branch includes the earlier UI fixes through #616 and retains merged Obsidian #612.
