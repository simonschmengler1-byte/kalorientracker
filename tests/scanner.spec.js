// Scanner-Test mit künstlicher Kamera (nur Chromium kann ein Video als Kamera einspielen)
import { test, expect, chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

test('Barcode wird über die (simulierte) Kamera erkannt', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'handy-chrome', 'nur in Chromium möglich');
  const video = testInfo.outputPath('barcode.y4m');
  mkdirSync(testInfo.outputDir, { recursive: true });
  execFileSync('node', ['tests/make-barcode-video.mjs', '4008400402222', video]);

  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`]
  });
  const context = await browser.newContext({
    ...testInfo.project.use,
    baseURL: 'http://localhost:4199/',
    permissions: ['camera'],
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await page.goto('./');
  await page.locator('[data-add="snack"]').click();
  await page.getByRole('button', { name: 'Barcode scannen' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/screenshots/handy-chrome-18-kamera.png' });
  // Nach dem Erkennen erscheint direkt das Produkt von Open Food Facts
  await expect(page.locator('.detail-head')).toContainText('Ferrero', { timeout: 30000 });
  await browser.close();
});
