import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`keeps silent response waits visible and yields to real activity at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/tests/review/model-wait.html');
    const waiting = page.locator('[data-slot="turn-response-wait"]');
    await expect(waiting).toBeVisible();
    await expect(waiting).toContainText('Waiting for response');
    await expect(waiting).toContainText(/\d+s/);
    await page.screenshot({ path: test.info().outputPath(`model-wait-${width}.png`) });
    await page.getByRole('button', { name: 'reasoning', exact: true }).click();
    await expect(waiting).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Activity: Thinking', exact: true }),
    ).toBeVisible();
    const thinking = page.getByRole('button', {
      name: 'Thinking: Comparing the notes',
      exact: true,
    });
    await expect(thinking).toBeVisible();
    await thinking.click();
    await expect(page.getByText('Simulated reasoning sample for this UI fixture.')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`model-reasoning-${width}.png`) });
    await page.getByRole('button', { name: 'tool', exact: true }).click();
    await expect(waiting).toHaveCount(0);
    await page.getByRole('button', { name: 'wait', exact: true }).click();
    await expect(waiting).toBeVisible();
    await page.getByRole('button', { name: 'complete', exact: true }).click();
    await expect(waiting).toHaveCount(0);
    await expect(
      page.getByText('The notes are summarized. Review the source before acting.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'paused', exact: true }).click();
    await expect(waiting).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
