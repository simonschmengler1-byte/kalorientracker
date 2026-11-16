// Durchklick-Tests der laufenden App
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const SHOTS = 'tests/screenshots';
mkdirSync(SHOTS, { recursive: true });

const shot = async (page, testInfo, name) => (await page.waitForTimeout(400), 0) ||
  page.locator('.sheet').count().then((open) => page.screenshot({ path: `${SHOTS}/${testInfo.project.name}-${name}.png`, fullPage: !open }));

const sheet = (page) => page.locator('.sheet');

async function openAdd(page, meal = 'breakfast') {
  await page.locator(`[data-add="${meal}"]`).click();
  await expect(sheet(page)).toBeVisible();
}

async function quickEntry(page, meal, name, kcal, protein = '') {
  await openAdd(page, meal);
  await sheet(page).getByRole('button', { name: 'Schnelleintrag', exact: true }).click();
  await sheet(page).locator('input[name="name"]').fill(name);
  await sheet(page).locator('input[name="kcal"]').fill(kcal);
  if (protein) await sheet(page).locator('input[name="protein"]').fill(protein);
  await sheet(page).getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.locator('.sheet-backdrop')).toHaveCount(0);
}

async function createCustomFood(page, { name, kcal, protein, carbs, fat, serving = '' }) {
  await sheet(page).getByRole('button', { name: 'Eigenes Lebensmittel' }).click();
  const s = sheet(page);
  await s.locator('input[name="name"]').fill(name);
  await s.locator('input[name="kcal"]').fill(kcal);
  await s.locator('input[name="protein"]').fill(protein);
  await s.locator('input[name="carbs"]').fill(carbs);
  await s.locator('input[name="fat"]').fill(fat);
  if (serving) await s.locator('input[name="servingGrams"]').fill(serving);
  await s.locator('button[type="submit"]').click();
}

const errors = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/camera|Kamera|NotAllowed|NotFound|getUserMedia|Permission|net::ERR|CORS|Access to fetch|Failed to load resource|play\(\) request/i.test(m.text())) errors.push(m.text()); });
  await page.goto('./');
  await expect(page.locator('.summary')).toBeVisible();
});
test.afterEach(async () => {
  expect(errors, 'Keine JavaScript-Fehler').toEqual([]);
});

test('Startseite, Ziel festlegen, leere Zustände', async ({ page }, testInfo) => {
  await expect(page.locator('.date-label')).toContainText('Heute');
  await expect(page.locator('.meal')).toHaveCount(4);
  await expect(page.getByText('Noch nichts eingetragen – tippe auf „+“.').first()).toBeVisible();
  await shot(page, testInfo, '01-tagebuch-leer');

  // Ziel berechnen
  await page.getByRole('link', { name: 'Ziele' }).click();
  await page.getByRole('button', { name: 'Männlich' }).click();
  await page.locator('input[name="age"]').fill('35');
  await page.locator('input[name="height"]').fill('180');
  await page.locator('input[name="weight"]').fill('80');
  await page.getByRole('button', { name: /Aktiv 3–5×/ }).click();
  await page.getByRole('button', { name: /Abnehmen/ }).click();
  // Mifflin: 10*80 + 6,25*180 - 5*35 + 5 = 1755; ×1,55 = 2720; −500 = 2220
  await expect(page.locator('[data-result]')).toContainText('1.755');
  await expect(page.locator('[data-result]')).toContainText('2.220 kcal');
  // Eiweiß 1,8*80 = 144; Fett 27% von 2220 / 9 = 67; KH (2220-576-603)/4 = 260
  await expect(page.locator('[data-result]')).toContainText('Eiweiß 144 g · Kohlenhydrate 260 g · Fett 67 g');
  await shot(page, testInfo, '02-ziele');
  await page.getByRole('button', { name: 'Als Ziel übernehmen' }).click();
  await expect(page.locator('[data-cur="kcal"]')).toHaveText('2.220');

  // Manuell überschreiben
  await page.locator('[data-manual] input[name="kcal"]').fill('2100');
  await page.getByRole('button', { name: 'Makros automatisch' }).click();
  await page.locator('[data-manual] button[type="submit"]').click();
  await expect(page.locator('[data-cur="kcal"]')).toHaveText('2.100');

  await page.getByRole('link', { name: 'Tagebuch' }).click();
  await expect(page.locator('.ring-side').nth(1)).toContainText('2.100');
  await expect(page.locator('.ring-center')).toContainText('2.100');
});

test('Einträge hinzufügen, ändern, löschen, rückgängig', async ({ page }, testInfo) => {
  // Eigenes Lebensmittel anlegen und eintragen
  await openAdd(page, 'breakfast');
  await expect(sheet(page).getByText('Noch nichts eingetragen')).toBeVisible();
  await shot(page, testInfo, '03-hinzufuegen-leer');
  await createCustomFood(page, { name: 'Haferflocken Test', kcal: '370', protein: '13,5', carbs: '58,7', fat: '7', serving: '40' });
  // Detailansicht: Portion vorgewählt (40 g → 148 kcal)
  await expect(sheet(page).locator('[data-grid]')).toContainText('148');
  await sheet(page).locator('[data-unit]').selectOption('g');
  await sheet(page).locator('[data-amount]').fill('60,5');
  await expect(sheet(page).locator('[data-grid]')).toContainText('224'); // 370*0,605 = 223,85
  await shot(page, testInfo, '04-detail');
  await sheet(page).getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.locator('[data-meal="breakfast"] .entry')).toHaveCount(1);
  await expect(page.locator('[data-meal="breakfast"] .meal-kcal')).toHaveText('224 kcal');
  await expect(page.locator('[data-meal="breakfast"] .entry-meta')).toContainText('60,5 g');

  // Schnelleintrag
  await quickEntry(page, 'snack', 'Stück Kuchen', '350', '5');
  await expect(page.locator('[data-meal="snack"] .meal-kcal')).toHaveText('350 kcal');
  await expect(page.locator('.ring-side').first()).toContainText('574');

  // Menge ändern
  await page.locator('[data-meal="breakfast"] .entry-main').click();
  await expect(sheet(page).locator('.sheet-title')).toHaveText('Eintrag bearbeiten');
  await sheet(page).locator('[data-amount]').fill('100');
  await sheet(page).getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('[data-meal="breakfast"] .meal-kcal')).toHaveText('370 kcal');

  // Zuletzt-Liste + Plus erneut eintragen (Mittagessen)
  await openAdd(page, 'lunch');
  await expect(sheet(page).locator('[data-recent]')).toHaveCount(2);
  await sheet(page).locator('[data-recent^="food:"] [data-readd]').click();
  await page.locator('.sheet-close').click();
  await expect(page.locator('[data-meal="lunch"] .meal-kcal')).toHaveText('370 kcal');

  await shot(page, testInfo, '05-tagebuch-gefuellt');

  // Löschen per X + Rückgängig
  await page.locator('[data-meal="snack"] [data-del]').click();
  await expect(page.locator('[data-meal="snack"] .entry')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('gelöscht');
  await page.locator('.toast-action').click();
  await expect(page.locator('[data-meal="snack"] .entry')).toHaveCount(1);

  // Wischen zum Löschen (nur Touch-Geräte)
  if (testInfo.project.name === 'handy-chrome') { // Touch-Ereignisse lassen sich nur in Chromium künstlich erzeugen
    const fg = page.locator('[data-meal="snack"] .entry-fg');
    const box = await fg.boundingBox();
    await fg.evaluate((node, b) => {
      const mk = (type, x) => {
        const t = new Touch({ identifier: 1, target: node, clientX: x, clientY: b.y + b.height / 2 });
        node.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true }));
      };
      mk('touchstart', b.x + b.width - 20);
      for (let i = 1; i <= 10; i++) mk('touchmove', b.x + b.width - 20 - i * 25);
      mk('touchend', b.x + b.width - 270);
    }, box);
    await expect(page.locator('[data-meal="snack"] .entry')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('Kuchen');
  }

  // Wasser
  await page.locator('.glass-btn').nth(0).click();
  await page.locator('.glass-btn').nth(1).click();
  await expect(page.locator('.water-total')).toHaveText('0,5');
  await page.locator('.glass-btn').nth(1).click(); // letztes Glas wieder leeren
  await expect(page.locator('.water-total')).toHaveText('0,25');

  // Datum wechseln
  await page.getByRole('button', { name: 'Vorheriger Tag' }).click();
  await expect(page.locator('.date-label')).toContainText('Gestern');
  await expect(page.locator('.entry')).toHaveCount(0);
  await page.locator('.date-label').click();
  await expect(page.locator('.date-label')).toContainText('Heute');
  await expect(page.locator('.entry').first()).toBeVisible();
});

test('Favoriten und eigenes Gericht', async ({ page }, testInfo) => {
  await openAdd(page, 'dinner');
  await sheet(page).getByRole('tab', { name: 'Favoriten' }).click();
  await expect(sheet(page).getByText('Noch keine Favoriten')).toBeVisible();
  await createCustomFood(page, { name: 'Hackfleisch', kcal: '250', protein: '20', carbs: '0', fat: '19' });
  await sheet(page).getByRole('button', { name: 'Zu Favoriten hinzufügen' }).click();
  await expect(sheet(page).getByRole('button', { name: 'Aus Favoriten entfernen' })).toBeVisible();
  await sheet(page).locator('.sheet-back').click();
  await sheet(page).getByRole('tab', { name: 'Favoriten' }).click();
  await expect(sheet(page).locator('[data-food]')).toContainText('Hackfleisch');
  await sheet(page).getByRole('tab', { name: 'Eigene Lebensmittel' }).click();
  await expect(sheet(page).locator('[data-food]')).toHaveCount(1);
  await createCustomFood(page, { name: 'Kidneybohnen', kcal: '90', protein: '6', carbs: '12', fat: '0,5' });
  await sheet(page).locator('.sheet-back').click();

  // Gericht anlegen
  await sheet(page).getByRole('tab', { name: 'Eigene Gerichte' }).click();
  await expect(sheet(page).getByText('Noch keine eigenen Gerichte')).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Neues Gericht erstellen' }).click();
  await sheet(page).locator('[data-name]').fill('Chili con Carne');
  await sheet(page).getByRole('button', { name: 'Zutat hinzufügen' }).click();
  await sheet(page).getByRole('tab', { name: 'Eigene Lebensmittel' }).click();
  await sheet(page).locator('[data-food]', { hasText: 'Hackfleisch' }).click();
  await sheet(page).locator('.ingredient input').nth(0).fill('500');
  await sheet(page).getByRole('button', { name: 'Zutat hinzufügen' }).click();
  await sheet(page).getByRole('tab', { name: 'Eigene Lebensmittel' }).click();
  await sheet(page).locator('[data-food]', { hasText: 'Kidneybohnen' }).click();
  await sheet(page).locator('.ingredient input').nth(1).fill('400');
  await sheet(page).locator('[data-portions]').fill('4');
  // 500 g × 2,5 + 400 g × 0,9 = 1250 + 360 = 1610 kcal / 4 = 402,5
  await expect(sheet(page).locator('[data-summary]')).toContainText('1.610 kcal');
  await expect(sheet(page).locator('[data-summary] .k')).toContainText('403');
  await shot(page, testInfo, '06-gericht');
  await sheet(page).getByRole('button', { name: 'Gericht speichern' }).click();
  await expect(sheet(page).locator('[data-recipe]')).toContainText('Chili con Carne');
  await sheet(page).locator('[data-recipe] .list-item-main').click();
  await expect(sheet(page).locator('[data-unit]')).toHaveValue('portion');
  await sheet(page).locator('[data-amount]').fill('1,5');
  await expect(sheet(page).locator('[data-grid] .k')).toContainText('604'); // 402,5 × 1,5
  await sheet(page).getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.locator('[data-meal="dinner"] .entry-meta')).toContainText('1,5 Portionen');
  await expect(page.locator('[data-meal="dinner"] .meal-kcal')).toHaveText('604 kcal');
});

test('Barcode: Open Food Facts und manuelle Eingabe', async ({ page }, testInfo) => {
  await openAdd(page, 'snack');
  await sheet(page).getByRole('button', { name: 'Barcode scannen' }).click();
  await expect(sheet(page).locator('.sheet-title')).toHaveText('Barcode scannen');
  await page.waitForTimeout(1500);
  await shot(page, testInfo, '07-scanner');
  // Barcode eintippen (Kamera ist im Test nicht verfügbar)
  await sheet(page).locator('input[name="code"]').fill('4008400402222');
  await sheet(page).getByRole('button', { name: 'Suchen' }).click();
  await expect(sheet(page).locator('.detail-head h3')).not.toBeEmpty({ timeout: 20000 });
  await expect(sheet(page).locator('.detail-head')).toContainText('Ferrero');
  await expect(sheet(page).locator('.per100')).toContainText('539 kcal');
  await shot(page, testInfo, '08-barcode-gefunden');
  await sheet(page).locator('[data-unit]').selectOption('g');
  await sheet(page).locator('[data-amount]').fill('50');
  await expect(sheet(page).locator('[data-grid] .k')).toContainText('270'); // 539 × 0,5 = 269,5
  await sheet(page).getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.locator('[data-meal="snack"] .entry')).toHaveCount(1);

  // Coca-Cola
  await openAdd(page, 'snack');
  await sheet(page).getByRole('button', { name: 'Barcode scannen' }).click();
  await sheet(page).locator('input[name="code"]').fill('5449000000996');
  await sheet(page).getByRole('button', { name: 'Suchen' }).click();
  await expect(sheet(page).locator('.detail-head')).toContainText('Coca', { timeout: 20000 });
  await expect(sheet(page).locator('[data-unit]')).toHaveValue('portion');
  await expect(sheet(page).locator('[data-grid] .k')).toContainText('145'); // 330 ml × 0,44
  await sheet(page).getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.locator('[data-meal="snack"] .entry')).toHaveCount(2);

  // Unbekannter Barcode -> Formular
  const unknown = '4012345000017';
  await openAdd(page, 'snack');
  await sheet(page).getByRole('button', { name: 'Barcode scannen' }).click();
  await sheet(page).locator('input[name="code"]').fill(unknown);
  await sheet(page).getByRole('button', { name: 'Suchen' }).click();
  await expect(sheet(page).getByText('wurde nicht gefunden')).toBeVisible({ timeout: 20000 });
  await expect(sheet(page).locator('input[name="barcode"]')).toHaveValue(unknown);
  await shot(page, testInfo, '09-barcode-nicht-gefunden');
  await sheet(page).locator('input[name="name"]').fill('Testriegel');
  await sheet(page).locator('input[name="kcal"]').fill('400');
  await sheet(page).locator('input[name="protein"]').fill('20');
  await sheet(page).locator('input[name="carbs"]').fill('40');
  await sheet(page).locator('input[name="fat"]').fill('15');
  await sheet(page).locator('input[name="servingGrams"]').fill('45');
  await sheet(page).locator('button[type="submit"]').click();
  await expect(sheet(page).locator('.detail-head h3')).toHaveText('Testriegel');
  await sheet(page).getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.locator('[data-meal="snack"] .entry')).toHaveCount(3);

  // Gleicher Barcode noch einmal -> sofort erkannt (auch offline)
  await page.context().setOffline(true);
  await openAdd(page, 'snack');
  await sheet(page).getByRole('button', { name: 'Barcode scannen' }).click();
  await sheet(page).locator('input[name="code"]').fill(unknown);
  await sheet(page).getByRole('button', { name: 'Suchen' }).click();
  await expect(sheet(page).locator('.detail-head h3')).toHaveText('Testriegel');
  // Unbekannter Barcode offline -> verständliche Meldung
  await sheet(page).locator('.sheet-back').click();
  await sheet(page).getByRole('button', { name: 'Barcode scannen' }).click();
  await sheet(page).locator('input[name="code"]').fill('4000417025005');
  await sheet(page).getByRole('button', { name: 'Suchen' }).click();
  await expect(sheet(page).getByText('Keine Internetverbindung')).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: 'Selbst eintragen' })).toBeVisible();
  await page.context().setOffline(false);
});

test('Suche bei Open Food Facts', async ({ page }, testInfo) => {
  // Open Food Facts erlaubt nur wenige Suchen pro Minute – daher nur in einer Ansicht testen
  test.skip(testInfo.project.name !== 'handy-chrome', 'Suche wird nur einmal getestet');
  await openAdd(page, 'breakfast');
  const input = sheet(page).getByRole('searchbox', { name: 'Lebensmittel suchen' });
  await input.fill('Haferflocken');
  await input.press('Enter');
  await expect(sheet(page).locator('[data-remote] [data-food]').first()).toBeVisible({ timeout: 25000 });
  await shot(page, testInfo, '10-suche');
  await sheet(page).locator('[data-remote] [data-food]').first().click();
  await expect(sheet(page).getByRole('button', { name: 'Hinzufügen', exact: true })).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.locator('[data-meal="breakfast"] .entry')).toHaveCount(1);

  // Ohne Internet
  await page.context().setOffline(true);
  await openAdd(page, 'breakfast');
  await input.fill('Joghurt');
  await input.press('Enter');
  await expect(sheet(page).getByText('Keine Internetverbindung')).toBeVisible();
  await shot(page, testInfo, '11-suche-offline');
  await page.context().setOffline(false);
});

test('Gewicht und Statistik', async ({ page }, testInfo) => {
  await page.getByRole('link', { name: 'Gewicht' }).click();
  await expect(page.getByText('Noch kein Gewicht eingetragen')).toBeVisible();
  let n = 0;
  const add = async (kg, date) => {
    await page.locator('input[name="kg"]').fill(kg);
    await page.locator('input[name="date"]').fill(date);
    await page.getByRole('button', { name: 'Speichern' }).first().click();
    await expect(page.locator('.weight-list .list-item')).toHaveCount(++n);
  };
  const d = (n) => {
    const x = new Date();
    x.setDate(x.getDate() - n);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  await add('82,4', d(20));
  await add('81,6', d(13));
  await add('80,9', d(6));
  await add('80,2', d(0));
  await page.locator('input[name="targetKg"]').fill('76');
  await page.locator('[data-target] button').click();
  await expect(page.locator('.stat').nth(0)).toContainText('82,4');
  await expect(page.locator('.stat').nth(1)).toContainText('80,2');
  await expect(page.locator('.stat').nth(2)).toContainText('−2,2');
  await expect(page.locator('.chart .line')).toBeVisible();
  await expect(page.locator('.chart .target-line')).toHaveCount(1);
  await shot(page, testInfo, '12-gewicht');
  // Löschen
  await page.locator('.weight-list [data-del]').first().click();
  await expect(page.locator('.stat').nth(1)).toContainText('80,9');

  // Statistik mit Daten
  await page.getByRole('link', { name: 'Tagebuch' }).click();
  await quickEntry(page, 'lunch', 'Pizza', '900', '35');
  await page.getByRole('button', { name: 'Vorheriger Tag' }).click();
  await quickEntry(page, 'lunch', 'Salat', '1500', '45');
  await page.getByRole('link', { name: 'Statistik' }).click();
  await expect(page.locator('.stat').nth(0)).toContainText('1.200');
  await expect(page.locator('.stat').nth(1)).toContainText('40 g');
  await expect(page.locator('.chart rect.bar-ok')).toHaveCount(2);
  await shot(page, testInfo, '13-statistik');
});

test('Sicherung exportieren und importieren', async ({ page }, testInfo) => {
  await quickEntry(page, 'breakfast', 'Müsli', '420');
  await page.getByRole('link', { name: 'Mehr' }).click();
  await expect(page.getByText('noch nie')).toBeVisible();
  await shot(page, testInfo, '14-einstellungen');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Sicherung herunterladen' }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/^kalorientracker-sicherung-\d{4}-\d{2}-\d{2}\.json$/);
  const file = testInfo.outputPath('backup.json');
  await download.saveAs(file);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  expect(json.app).toBe('kalorientracker');
  expect(json.data.entries).toHaveLength(1);
  await expect(page.getByText('noch nie')).toHaveCount(0);

  // Daten ändern: weiteren Eintrag anlegen
  await page.getByRole('link', { name: 'Tagebuch' }).click();
  await quickEntry(page, 'lunch', 'Nudeln', '700');
  await expect(page.locator('.entry')).toHaveCount(2);

  // Falsche Datei
  await page.getByRole('link', { name: 'Mehr' }).click();
  await page.locator('[data-file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
  await expect(page.locator('#toast')).toContainText('keine Sicherung dieser App');

  // Wiederherstellen: Abbrechen
  await page.locator('[data-file]').setInputFiles(file);
  await expect(page.locator('.modal')).toContainText('werden gelöscht');
  await shot(page, testInfo, '15-wiederherstellen-warnung');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('.modal')).toHaveCount(0);
  // Wiederherstellen: Bestätigen
  await page.locator('[data-file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Ersetzen' }).click();
  await expect(page.locator('#toast')).toContainText('wiederhergestellt');
  await page.getByRole('link', { name: 'Tagebuch' }).click();
  await expect(page.locator('.entry')).toHaveCount(1);
  await expect(page.locator('.entry-name')).toHaveText('Müsli');
});

test('Sicherungs-Erinnerung nach 14 Tagen', async ({ page }) => {
  await quickEntry(page, 'breakfast', 'Brot', '200');
  await page.evaluate(async () => {
    await window.__db.settings.put({ key: 'firstUse', value: '2020-01-01' });
  });
  await page.reload();
  await expect(page.getByText('Zeit für eine Sicherung')).toBeVisible();
  await page.getByRole('button', { name: 'Später' }).click();
  await expect(page.getByText('Zeit für eine Sicherung')).toHaveCount(0);
});

test('Dunkler Modus', async ({ page }, testInfo) => {
  await quickEntry(page, 'breakfast', 'Banane', '105', '1');
  await page.getByRole('link', { name: 'Mehr' }).click();
  await page.getByRole('button', { name: 'Dunkel' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'Tagebuch' }).click();
  await shot(page, testInfo, '16-dunkel-tagebuch');
  await openAdd(page, 'lunch');
  await shot(page, testInfo, '17-dunkel-hinzufuegen');
  await page.locator('.sheet-close').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
