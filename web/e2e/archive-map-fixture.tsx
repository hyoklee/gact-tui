import { createRoot } from 'react-dom/client';
import { ArchiveConnectionProvider } from '../src/providers/connection-provider';
import { ClioScientificMapView } from '../src/components/clio/scientific-map-view';
import { configureArchiveMapWorker } from '../src/lib/session-export/map-worker';
import '../src/index.css';

configureArchiveMapWorker(import.meta.env.VITE_CLIO_ARCHIVE_MAP_WORKER);
const polygon = new URLSearchParams(location.search).get('kind') === 'polygon';
const points = Array.from({ length: polygon ? 1 : 201 }, (_, i) => ({
  id: polygon ? 'test-polygon' : `test-${i}`,
  label: `Synthetic renderer test ${i}`,
  latitude: 34.5 + (i % 15) * 0.05,
  longitude: -120 + Math.floor(i / 15) * 0.05,
}));
createRoot(document.getElementById('root')!).render(
  <ArchiveConnectionProvider>
    <p>Synthetic renderer fixture; no scientific observations.</p>
    <div style={{ height: 480, width: 800 }}>
      <ClioScientificMapView
        points={points}
        geometry={
          polygon
            ? {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    id: 'test-polygon',
                    properties: {},
                    geometry: {
                      type: 'Polygon',
                      coordinates: [
                        [
                          [-120, 34],
                          [-119, 34],
                          [-119, 35],
                          [-120, 35],
                          [-120, 34],
                        ],
                      ],
                    },
                  },
                ],
              }
            : undefined
        }
        geometryBounds={
          polygon
            ? [
                [-120, 34],
                [-119, 35],
              ]
            : undefined
        }
        onSelect={() => undefined}
      />
    </div>
  </ArchiveConnectionProvider>,
);
