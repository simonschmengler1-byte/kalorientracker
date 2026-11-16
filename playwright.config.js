import { defineConfig, devices } from '@playwright/test';

// Getestet wird die fertig gebaute App (wie sie online läuft)
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 2,
  retries: 1, // Open Food Facts ist manchmal kurz überlastet
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4199/',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    acceptDownloads: true,
    serviceWorkers: 'block'
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4199 --strictPort',
    url: 'http://localhost:4199/',
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: 'handy-chrome',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }
      }
    },
    {
      name: 'handy-safari',
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } }
    }
  ]
});
