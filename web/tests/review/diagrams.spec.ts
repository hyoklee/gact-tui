import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const workspace = process.env['CLIO_DIAGRAM_REVIEW_WORKSPACE'];
if (!workspace)
  throw new Error('Set CLIO_DIAGRAM_REVIEW_WORKSPACE to the isolated real workspace.');
const gallery = `/tests/review/diagrams.html?workspace=${workspace}`;

for (const theme of ['light', 'dark']) {
  for (const width of [390, 640, 1280]) {
    test(`${theme} diagrams at ${width}px use bundled renderers without overflow`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${gallery}&theme=${theme}`);
      await expect(page.locator('div[role="img"] > svg.pele')).toHaveCount(6);
      await expect(page.locator('[role="alert"]')).toHaveCount(0);
      for (const kind of ['sequence', 'gitGraph', 'mindmap', 'railroad'])
        await expect(page.locator(`div[role="img"] > svg.pele-${kind}`)).toHaveCount(1);
      const sizes = await page
        .locator('canvas[role="img"]')
        .evaluateAll((elements) =>
          elements.map((e) => ({ width: e.clientWidth, height: e.clientHeight })),
        );
      expect(sizes).toHaveLength(6);
      for (const size of sizes) {
        expect(size.width).toBeGreaterThan(200);
        expect(size.width).toBeLessThanOrEqual(width);
        expect(size.height).toBeGreaterThan(80);
      }
      expect(sizes[5]!.height).toBeGreaterThan(sizes[0]!.height * 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const palette = await page
        .locator('div[role="img"] > svg.pele')
        .first()
        .evaluate((e) => (e as SVGElement).style.getPropertyValue('--pele-fg'));
      expect(palette).not.toBe('');
      const headingsFit = await page
        .locator('h3')
        .evaluateAll((headings) =>
          headings.every((heading) => heading.scrollWidth <= heading.clientWidth),
        );
      expect(headingsFit).toBe(true);
      await page.screenshot({
        path: info.outputPath(`diagrams-${theme}-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
}

test('unchanged parent updates preserve diagram DOM and fractional canvas geometry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 631, height: 900 });
  await page.goto(`${gallery}&theme=light`);
  const diagram = page.getByRole('region', { name: 'Workflow folders', exact: true }).last();
  await expect(diagram.getByRole('button', { name: 'Reset zoom', exact: true })).toBeEnabled();
  await diagram.evaluate((element) => {
    const state = element as HTMLElement & {
      reviewMutations: string[];
      reviewObserver: MutationObserver;
    };
    state.reviewMutations = [];
    state.reviewObserver = new MutationObserver((records) =>
      state.reviewMutations.push(
        ...records.map((record) => `${record.type}:${record.attributeName}`),
      ),
    );
    state.reviewObserver.observe(element, { subtree: true, childList: true, attributes: true });
  });
  await page.getByRole('button', { name: 'Refresh diagram views', exact: true }).click();
  const mutations = await diagram.evaluate(
    (element) =>
      new Promise<string[]>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const state = element as HTMLElement & {
              reviewMutations: string[];
              reviewObserver: MutationObserver;
            };
            state.reviewObserver.disconnect();
            resolve(state.reviewMutations);
          }),
        ),
      ),
  );
  expect(mutations).toEqual([]);
});

test('folder node opens the real directory and back returns to the workspace root', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${gallery}&theme=light`);
  const workflow = page.getByRole('region', { name: 'Workflow folders', exact: true }).last();
  await expect(workflow.locator('div[role="img"] > svg.pele-flowchart')).toHaveCount(1);
  const canvas = workflow.locator('canvas');
  await expect(workflow.getByRole('button', { name: 'Reset zoom', exact: true })).toBeEnabled();
  await workflow.hover();
  await workflow.getByRole('button', { name: 'Reset zoom', exact: true }).click();
  // The center stage is centered in this three-node diagram. This exercises the
  // real canvas hit-region path, not the accessible keyboard alternative.
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Workflow canvas is missing.');
  // Selectable SVG text overlays the canvas and forwards ordinary clicks to
  // the same region handler, so use a real pointer click at the rendered node.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const files = page.getByRole('region', { name: 'Real workspace files' });
  await expect(files.getByText('analysis', { exact: true })).toBeVisible();
  await expect(files.getByRole('treeitem', { name: 'README.md' })).toBeVisible();
  await files.getByRole('treeitem', { name: 'README.md' }).click();
  await expect(files.getByText('Validate station measurements before aggregation.')).toBeVisible();
  await page.screenshot({
    path: info.outputPath('diagram-opens-real-folder.png'),
    animations: 'disabled',
  });
  await files.getByRole('button', { name: 'All folders', exact: true }).click();
  await expect(
    files.getByRole('button', { name: 'Expand folder analysis', exact: true }),
  ).toBeVisible();
});

test('diagram exports standalone themed SVG and PNG with no external rendering service', async ({
  page,
}, info) => {
  await page.goto(`${gallery}&theme=dark`);
  const diagram = page.getByRole('region', { name: 'Railroad grammar', exact: true }).last();
  await expect(diagram.locator('div[role="img"] > svg.pele-railroad')).toHaveCount(1);
  const paths: Record<string, string> = {};
  for (const [label, extension] of [
    ['SVG image', 'svg'],
    ['PNG image', 'png'],
  ] as const) {
    await diagram.hover();
    await diagram.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Download', exact: true }).hover();
    const started = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: label, exact: true }).click();
    const download = await started;
    expect(await download.failure()).toBeNull();
    const path = info.outputPath(`railroad.${extension}`);
    await download.saveAs(path);
    paths[extension] = path;
  }
  const svg = await readFile(paths['svg']!, 'utf8');
  expect(svg).toContain('pele-railroad');
  expect(svg).toContain('--pele-fg:');
  expect(svg).not.toMatch(/<script|<foreignObject|href="https?:\/\//);
  const png = await readFile(paths['png']!);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
