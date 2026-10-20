import { expect, test } from '@playwright/test';

const port = process.env.CLIO_ARCHIVE_MAP_PORT ?? '18849';
for (const kind of ['points', 'polygon']) {
  for (const origin of ['normal', 'opaque']) {
    test(`archive ${kind} paint at a ${origin} origin without external requests`, async ({
      page,
    }) => {
      const external: string[] = [];
      page.on('request', (request) => {
        if (/^https?:/.test(request.url()) && new URL(request.url()).port !== port)
          external.push(request.url());
      });
      await page.goto(
        `http://127.0.0.1:${port}/${origin === 'opaque' ? 'opaque' : 'map'}?kind=${kind}`,
      );
      const target = origin === 'opaque' ? page.frameLocator('iframe') : page;
      const surface = target.locator('[data-slot="a2ui-map-surface"]');
      await expect(surface).toBeVisible();
      const layer = kind === 'points' ? 'clio-map-points-circles' : 'clio-map-geometry-fill';
      // Inspect the real worker-decoded/rendered layer, not just a mounted canvas.
      await expect
        .poll(
          () =>
            surface.evaluate((node, id) => {
              const map = (
                node as HTMLElement & {
                  __clioMap?: {
                    getLayer(id: string): unknown;
                    queryRenderedFeatures(options: { layers: string[] }): unknown[];
                  };
                }
              ).__clioMap;
              return map?.getLayer(id) ? map.queryRenderedFeatures({ layers: [id] }).length : 0;
            }, layer),
          { timeout: 20_000 },
        )
        .toBeGreaterThan(0);
      await surface.screenshot({ path: test.info().outputPath(`${kind}-${origin}.png`) });
      expect(external).toEqual([]);
    });
  }
}
