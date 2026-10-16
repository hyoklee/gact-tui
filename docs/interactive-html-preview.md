# Interactive HTML previews

Opening a generated HTML artifact runs its JavaScript in a separate frame. Static
HTML keeps the existing script-free preview. The Source tab always shows the
original file. Stop removes the running frame; Restart creates a fresh instance.

WebGL works in this frame. Three.js 0.180.0 and OrbitControls are supplied offline:

```html
<script type="module">
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  // Create a canvas, renderer, camera and scene as in an ordinary web page.
</script>
```

Classic scripts may also use `THREE`. Additional Three.js addons resolve against
the same pinned version on jsDelivr. Scripts from jsDelivr, unpkg and cdnjs are
allowed, so those libraries need network access unless bundled into the file.
Model authors should prefer the supplied offline imports for portable scenes.

The frame has scripts enabled and a separate opaque origin. It has no same-origin
permission. Its policy blocks fetch/WebSocket connections, nested frames, forms
and embedded objects. On Desktop it loads a stateless backend bootstrap document
before receiving the preview over postMessage; this avoids inheriting the app's
script policy. The main app keeps `script-src 'self'`. The bootstrap route serves
constant HTML only and exposes no files or API actions.

These boundaries are practical browser containment. Removing an iframe is not a
guaranteed process-level kill switch, and this policy is not a complete network
firewall. The browser acceptance checks exercise real WebGL pixels, OrbitControls,
a slider, Stop/Restart, offline loading and the actual Desktop parent CSP.

# Goal and model loading feedback

The retained goal `judging` phase shows **Checking goal completion** with an
elapsed timer in the conversation and Work view. Semantic goal events invalidate
the shared work query immediately; the normal poll remains a recovery path.
Reduced-motion mode uses a plain status label.

The model picker paints provider rows before preparing large model lists. It
prepares the selected provider first, then remaining providers in background
frames. Prepared facts are cached for reopening, and startup queries warm the
provider catalog and selected model list. Refreshing does not clear the current
query or filters.

For browser acceptance, start the owned Vite development server on port 5198 and
the real backend renderer on port 8198, set `CLIO_REVIEW_EVIDENCE` to an owned
output directory, then run:

```powershell
pnpm --filter @clio/workspace exec playwright test -c tests/review/webgl-playwright.config.ts
```
