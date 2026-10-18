import { defineConfig } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MB_FIXTURE_PORT ?? 5199);

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    headless: true,
    ignoreHTTPSErrors: false,
  },
  webServer: {
    command: `node ${resolve(here, 'scripts/serve-fixtures.mjs')} ${PORT}`,
    url: `http://127.0.0.1:${PORT}/gmail.html`,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
