import { setWorkerUrl } from 'maplibre-gl';

/** Install the contained classic worker without a cross-origin module import. */
export function configureArchiveMapWorker(source: string): void {
  // MapLibre 6 selects classic workers by a .cjs URL suffix. A fragment keeps
  // the blob identity intact while declaring the IIFE's actual format. Without
  // it, file/opaque origins get an extra module import blocked by archive CSP.
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  setWorkerUrl(`${url}#archive-worker.cjs`);
}
