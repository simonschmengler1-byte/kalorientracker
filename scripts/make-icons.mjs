// Erzeugt die PNG-Icons aus public/icon.svg (einmalig ausführen: node scripts/make-icons.mjs)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, file, { maskable = false, square = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  let inner = svg;
  if (square || maskable) inner = svg.replace('rx="112"', 'rx="0"');
  const scale = maskable ? 0.8 : 1;
  await page.setContent(`<html><body style="margin:0;background:#1f9d55;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size * scale}px;height:${size * scale}px">${inner.replace('<svg ', `<svg width="${size * scale}" height="${size * scale}" `)}</div></body></html>`);
  await page.screenshot({ path: `public/${file}`, omitBackground: !square && !maskable });
}
await render(192, 'icon-192.png', { square: true });
await render(512, 'icon-512.png', { square: true });
await render(512, 'icon-maskable-512.png', { maskable: true });
await render(180, 'apple-touch-icon.png', { square: true });
await render(48, 'favicon.png', { square: false });
await browser.close();
