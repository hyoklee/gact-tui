import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'unified-updates.spec.ts',
  workers: 1,
  retries: 0,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5223',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'pnpm exec vite --config tests/review/unified-updates.vite.config.ts --host 127.0.0.1 --port 5223 --strictPort',
    port: 5223,
    reuseExistingServer: false,
  },
});
