import { test, expect, type Page } from '@playwright/test';

const sea = {
  id: 'sea',
  name: 'coastal_stations_2026',
  title: 'Coastal sea observations',
  description: 'Wave height and station measurements from the coastal research network.',
  endpoint_id: 'ocean',
  endpoint_name: 'Ocean Research Endpoint',
  access: null,
  resources: [
    {
      id: 'stations',
      path: 'stations.csv',
      name: 'Station measurements.csv',
      format: 'CSV',
      size: 16384,
      revision: 'r1',
    },
    {
      id: 'waves',
      path: 'waves.nc',
      name: 'Ocean wave heights.nc',
      format: 'NetCDF',
      size: 5242880,
      revision: 'r2',
    },
  ],
};
const atmosphere = {
  ...sea,
  id: 'climate',
  name: 'NCAR_CESM2_historical_surface_v202610',
  title: 'Historical surface temperatures',
  description: 'Daily temperature measurements from a global climate simulation.',
  endpoint_id: 'climate',
  endpoint_name: 'Climate Research Endpoint',
  resources: [
    { ...sea.resources[0], id: 'temperatures', name: 'Surface temperature.nc', format: 'NetCDF' },
  ],
};
const astro = {
  ...sea,
  id: 'astro',
  name: 'stellar_spectra_2026',
  title: 'Stellar spectra survey',
  description: 'Spectra and photometry for nearby stars.',
  endpoint_name: 'Astronomy Endpoint',
  resources: [{ ...sea.resources[0], id: 'stars', name: 'stellar-spectra.fits', format: 'FITS' }],
};

async function catalogFixture(page: Page) {
  const selections: { dataset_id: string; resource_ids: string[] }[] = [];
  const searches: string[] = [];
  let linked = false;
  const source = {
    id: 'source-ndp',
    label: sea.title,
    provider: 'ndp',
    root: 'sea',
    owner: { clio_id: 'clio', host_id: 'local' },
    mode: 'read_only',
    capabilities: { supported_modes: ['read_only'], download: true, link_folder: true },
    connected: true,
    authenticated: true,
    configuration: {},
    local_path: null,
    linked: false,
    link_available: true,
    download_available: true,
    link_access: 'read_only',
    download_access: 'editable',
  };
  await page.route('**/v1/storage/ndp/search', async (route) => {
    const input = route.request().postDataJSON();
    searches.push(input.query);
    const words = input.query.toLowerCase().split(/\s+/).filter(Boolean);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({
      json: {
        datasets: [sea, atmosphere, astro].filter((dataset) =>
          words.every((word: string) => JSON.stringify(dataset).toLowerCase().includes(word)),
        ),
        warnings: input.only_groups
          ? ['NDP could not check Endpoint access. Catalog browsing is still available.']
          : [],
      },
    });
  });
  await page.route('**/v1/workspaces/workspace/sources/ndp', async (route) => {
    selections.push(route.request().postDataJSON());
    await route.fulfill({ json: source });
  });
  await page.route('**/sources/source-ndp/operations', (route) =>
    route.fulfill({ json: { operations: [] } }),
  );
  await page.route('**/sources/source-ndp/mapping-options', (route) =>
    route.fulfill({
      json: {
        link_access: ['read_only'],
        write_permission: false,
        reason: 'NDP originals cannot be changed through this connection.',
      },
    }),
  );
  await page.route('**/sources/source-ndp/browse', (route) =>
    route.fulfill({
      json: {
        source_id: 'source-ndp',
        entries: sea.resources.map((resource) => ({
          path: resource.path,
          kind: 'file',
          size: resource.size,
          revision: resource.revision,
        })),
        next_offset: null,
      },
    }),
  );
  await page.route('**/sources/source-ndp/draft', (route) =>
    route.fulfill({ json: { id: 'draft' } }),
  );
  await page.route('**/sources/source-ndp/link', async (route) => {
    linked = true;
    await route.fulfill({ json: { ...source, linked: true } });
  });
  await page.route('**/sources/source-ndp/reference', (route) =>
    route.fulfill({
      json: {
        id: 'resource-ndp',
        workspace_id: 'workspace',
        name: 'folder-index.json',
        state: 'ready',
        detected_mime: 'application/json',
        declared_size: 100,
        received_size: 100,
        revision: 1,
        sha256: 'a'.repeat(64),
        created_at: '2026-10-17T00:00:00Z',
        updated_at: '2026-10-17T00:00:00Z',
      },
    }),
  );
  return { selections, searches, isLinked: () => linked };
}

test('live catalog filtering, selection and the shared source review render in both themes and on mobile', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const fixture = await catalogFixture(page);
  await page.setViewportSize({ width: 1100, height: 900 });
  for (const theme of ['light', 'dark']) {
    await page.goto(`/tests/review/ndp-source.html?theme=${theme}`);
    await expect(page.getByRole('button', { name: /Coastal sea observations/ })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Historical surface temperatures/ }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ndp-browse-${theme}.png`), fullPage: true });
    await page.getByRole('textbox', { name: 'Search NDP datasets' }).fill('station');
    await expect(page.getByRole('button', { name: /Historical surface temperatures/ })).toHaveCount(
      0,
    );
    await expect(page.getByRole('checkbox', { name: /Station measurements.csv/ })).toBeVisible();
    await page.getByRole('checkbox', { name: /Station measurements.csv/ }).check();
    await page.getByRole('checkbox', { name: /Ocean wave heights.nc/ }).check();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await expect(page.getByText(/Nothing is downloaded/)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`ndp-${theme}.png`), fullPage: true });
  }
  expect(fixture.selections).toEqual([]);
  expect(fixture.isLinked()).toBe(false);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'How do you want to use these files?' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download all' })).toBeVisible();
  await expect(page.getByText('stations.csv', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(fixture.selections).toEqual([
    { endpoint_id: 'ocean', dataset_id: 'sea', resource_ids: ['stations', 'waves'] },
  ]);
  expect(fixture.isLinked()).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('ndp-source-review.png'), fullPage: true });
  await page.getByRole('button', { name: 'Link folder' }).click();
  await expect(page.getByText('Attached: Coastal sea observations')).toBeVisible();
  expect(fixture.isLinked()).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('textbox', { name: 'Search NDP datasets' }).fill('station');
  await expect(page.getByRole('checkbox', { name: /Station measurements.csv/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('ndp-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('selections survive filtering and remote result changes', async ({ page }) => {
  const fixture = await catalogFixture(page);
  await page.goto('/tests/review/ndp-source.html');
  await page.getByRole('textbox', { name: 'Search NDP datasets' }).fill('station');
  await page.getByRole('checkbox', { name: /Station measurements.csv/ }).check();
  await page.getByRole('textbox', { name: 'Search NDP datasets' }).fill('temperature');
  await page.getByRole('checkbox', { name: /Surface temperature.nc/ }).check();
  await page.getByRole('button', { name: 'Selected (2)' }).click();
  await expect(page.getByRole('button', { name: /Coastal sea observations/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Historical surface temperatures/ })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'How do you want to use these files?' }),
  ).toBeVisible();
  expect(
    fixture.selections.map((selection) => [selection.dataset_id, selection.resource_ids]),
  ).toEqual([
    ['sea', ['stations']],
    ['climate', ['temperatures']],
  ]);
});

test('a large catalog keeps selection actions visible and finds results beyond the rendered page', async ({
  page,
}) => {
  await catalogFixture(page);
  const rows = Array.from({ length: 50 }, (_, index) => ({
    ...sea,
    id: `catalog-${index}`,
    name: `CESM2_historical_daily_v01_${index}`,
    title: `Catalog example ${index}`,
    resources: [{ ...sea.resources[0], name: `${index}-data.csv` }],
  }));
  await page.route('**/v1/storage/ndp/search', (route) => {
    const query = route.request().postDataJSON().query;
    return route.fulfill({
      json: { datasets: rows.filter((row) => JSON.stringify(row).includes(query)), warnings: [] },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/review/ndp-source.html');
  await expect(page.getByRole('button', { name: /Catalog example 0 / })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeInViewport();
  await expect(page.getByRole('button', { name: /Catalog example 39 / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show more datasets' }).click();
  await expect(page.getByRole('button', { name: /Catalog example 39 / })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeInViewport();
  await page.getByRole('textbox', { name: 'Search NDP datasets' }).fill('39');
  await expect(page.getByRole('checkbox', { name: /39-data.csv/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
