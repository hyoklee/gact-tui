# PDF page fitting and document zoom

The workspace forced PDF previews into width fitting. The toolbar's Fit action
only reset the zoom multiplier to 100%, so a wide reading pane still showed a
very large page. The viewer also had no modifier-wheel listener, allowing
Ctrl+wheel over a PDF to reach Desktop's window zoom handler.

PDF previews now start in page fit. Fit switches an explicitly width-fitted
viewer to page fit and resets its document zoom. Each page uses the rotated
dimensions reported by pdf.js, accounting for both available width and reading
height, scroller padding, borders and scrollbar width. Empty virtual spacers do
not add visible gaps above/below the page. Continuous scrolling and bounded
page mounting remain in place.

A non-passive listener at the PDF scrollport handles Ctrl/Meta+wheel, prevents
browser zoom and stops the event before Desktop's window handler. Ordinary wheel
scrolling is unchanged. Toolbar and wheel actions share the document zoom state,
bounded between 25% and 400% of the fitted size. Existing canvas pixel-allocation
limits remain in effect.

Authored coverage checks portrait, landscape and tall page geometry, switching
from width to page fit, modifier-wheel cancellation/propagation, ordinary
scrolling, and the existing continuous-page behavior. The hosted desktop/phone
document preview scenarios also require the full rendered page to fit, use real
Ctrl+wheel input, assert document zoom changes while window geometry stays the
same, and verify Fit restores the page. Their existing PDF bytes, text, density,
download, lineage and one-conversion checks remain.

Local validation is source/diff inspection and Prettier only. No local test
suites, browser probes, screenshots, app builds/reloads or inference were run.
Hosted CI must qualify the exact head before merging. The installed app remains
unchanged. This branch includes #611, #613, #614 and #615 and retains already
merged Obsidian UI #612.
