import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`follows live groups and preserves reader overrides at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/tests/review/live-activity.html');
    const read = page.getByRole('button', {
      name: 'Activity: Read files, ran commands',
      exact: true,
    });
    await expect(read).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByRole('button', { name: 'Show result for Read', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Show next activity group', exact: true }).click();
    const write = page.getByRole('button', { name: 'Activity: Editing files', exact: true });
    await expect(read).toHaveAttribute('aria-expanded', 'false');
    await expect(write).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Finish fixture', exact: true }).click();
    await expect(read).toHaveAttribute('aria-expanded', 'false');
    await expect(
      page.getByRole('button', { name: 'Activity: Edited files', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Show next activity group', exact: true }).click();
    await expect(write).toHaveAttribute('aria-expanded', 'true');
    await write.click();
    await page.getByRole('button', { name: 'Hide transcript', exact: true }).click();
    await page.getByRole('button', { name: 'Show transcript', exact: true }).click();
    await expect(write).toHaveAttribute('aria-expanded', 'false');
    await read.click();
    await page.getByRole('button', { name: 'Finish fixture', exact: true }).click();
    await expect(read).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByRole('button', { name: 'Activity: Edited files', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath(`live-choices-${width}.png`) });
  });
}
