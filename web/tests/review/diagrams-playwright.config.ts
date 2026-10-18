import { defineConfig } from '@playwright/test';

const evidence = process.env['CLIO_REVIEW_EVIDENCE'];
if (!evidence) throw new Error('Set CLIO_REVIEW_EVIDENCE to a bounded review output directory.');
export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: 'diagrams.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  outputDir: `${evidence}/browser-results`,
  use: { baseURL: 'http://127.0.0.1:5226', screenshot: 'only-on-failure' },
});
