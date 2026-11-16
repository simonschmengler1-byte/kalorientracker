// Prüft, ob die (Online-)Version installierbar ist und offline startet.
// Aufruf: node tests/pwa-check.mjs https://…/kalorientracker/
import { chromium } from '@playwright/test';

const url = process.argv[2];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
const page = await context.newPage();
await page.goto(url);
await page.waitForSelector('.summary');

const manifestHref = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.href);
const manifest = manifestHref ? await (await fetch(manifestHref)).json() : null;
console.log('Manifest:', manifest ? `${manifest.name}, display=${manifest.display}, ${manifest.icons.length} Icons` : 'FEHLT');
for (const icon of manifest?.icons ?? []) {
  const res = await fetch(new URL(icon.src, manifestHref));
  console.log(`  Icon ${icon.sizes}: HTTP ${res.status}`);
}

// Warten, bis der Service Worker alles zwischengespeichert hat
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(2000);
console.log('Service Worker aktiv:', await page.evaluate(() => !!navigator.serviceWorker.controller || 'nach Neuladen'));

// Offline neu laden
await context.setOffline(true);
await page.reload();
const ok = await page.locator('.summary').isVisible({ timeout: 10000 }).catch(() => false);
console.log('Startet offline:', ok ? 'ja' : 'NEIN');
await page.screenshot({ path: 'tests/screenshots/online-offline-start.png' });
await browser.close();
process.exit(ok && manifest ? 0 : 1);
