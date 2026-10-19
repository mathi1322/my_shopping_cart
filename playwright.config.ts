import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive the production build (`npm run build`) in real
 * browsers. Each test creates its own users and products, so the suite only
 * needs a migrated database — but it does write data, hence the same
 * "must be a test database" guard as the integration suite.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to run e2e tests');
}
const databaseName = new URL(databaseUrl).pathname.slice(1);
if (!/test/i.test(databaseName)) {
  throw new Error(`Refusing to run e2e tests against "${databaseName}": use a *test* database.`);
}

const PORT = Number(process.env.E2E_PORT ?? 4329);
// Set E2E_BASE_URL to test an already-running deployment (e.g. the Docker image behind
// a TLS proxy) instead of starting the local production build.
const externalBaseURL = process.env.E2E_BASE_URL;
const baseURL = externalBaseURL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Self-signed certificates in the local TLS-proxy setup.
    ignoreHTTPSErrors: !!externalBaseURL,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: /(buyer|catalog|fulfillment-reviews)\.spec\.ts/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      testMatch: /(buyer|catalog|fulfillment-reviews)\.spec\.ts/,
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'node dist/scripts/migrate.mjs && node dist/server/entry.mjs',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 60_000,
        env: { DATABASE_URL: databaseUrl, PORT: String(PORT), HOST: '127.0.0.1' },
      },
});
