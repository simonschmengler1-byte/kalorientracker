// Einstellungen & Datensicherung
import { db, getSetting } from '../db.js';
import { icons } from '../icons.js';
import { num, shortDate, daysBetween, today } from '../format.js';
import { downloadBackup, canShareFiles, shareBackup, parseBackup, restoreBackup, countRows } from '../backup.js';
import { $, $$, toast, confirmDialog } from '../ui.js';

export async function renderSettings(container) {
  const lastBackup = await getSetting('lastBackup');
  const counts = {
    entries: await db.entries.count(),
    foods: await db.foods.where('source').equals('custom').count(),
    recipes: await db.recipes.count(),
    weights: await db.weights.count()
  };
  let theme = 'system';
  try { theme = localStorage.getItem('theme') || 'system'; } catch { /* egal */ }
  const age = lastBackup ? daysBetween(lastBackup.slice(0, 10), today()) : null;
  const share = canShareFiles();

  let persisted = null;
  try { persisted = await navigator.storage?.persisted?.(); } catch { /* egal */ }

  container.innerHTML = `
    <h1 class="page-title">Einstellungen</h1>

    <section class="card">
      <div class="card-title"><span>Darstellung</span></div>
      <div class="segmented" data-theme-seg>
        <button type="button" data-v="system">System</button>
        <button type="button" data-v="light">Hell</button>
        <button type="button" data-v="dark">Dunkel</button>
      </div>
    </section>

    <section class="card">
      <div class="card-title"><span>Datensicherung</span></div>
      <div class="banner info" style="margin-bottom:14px">${icons.info}
        <p>Alle deine Daten werden <b>nur auf diesem Gerät</b> in diesem Browser gespeichert – nicht im Internet. Wenn du die App löschst, die Website-Daten im Browser entfernst oder das Handy verlierst, sind sie weg. Lade deshalb regelmäßig eine Sicherung herunter und bewahre sie gut auf (z. B. in iCloud Drive, Google Drive oder per E-Mail an dich selbst).</p>
      </div>
      <p class="small" style="margin-bottom:12px">
        Letzte Sicherung: <b>${lastBackup ? `${shortDate(lastBackup.slice(0, 10))}${age > 14 ? ' – bitte erneuern' : ''}` : 'noch nie'}</b><br>
        <span class="muted">Gespeichert: ${num(counts.entries)} Einträge, ${num(counts.foods)} eigene Lebensmittel, ${num(counts.recipes)} Gerichte, ${num(counts.weights)} Gewichtswerte</span>
      </p>
      <div class="btn-row" style="flex-direction:column">
        <button type="button" class="btn btn-primary" data-download>${icons.download} Sicherung herunterladen</button>
        ${share ? `<button type="button" class="btn btn-outline" data-share>${icons.upload} Sicherung teilen / in Dateien sichern</button>` : ''}
        <button type="button" class="btn btn-outline" data-restore>${icons.upload} Sicherung wiederherstellen</button>
      </div>
      <input type="file" accept=".json,application/json" data-file hidden>
    </section>

    <section class="card explain">
      <div class="card-title" style="color:var(--text)"><span>Über die App</span></div>
      <p>Produktdaten stammen aus der freien Datenbank <b>Open Food Facts</b> (openfoodfacts.org). Die Werte werden von Freiwilligen eingetragen und können Fehler enthalten – im Zweifel gilt die Packung.</p>
      <p>Die App funktioniert auch ohne Internet. Nur die Barcode-Abfrage und die Online-Suche brauchen eine Verbindung.</p>
      <p class="small">${persisted ? 'Der Browser hat dauerhaften Speicher für diese App zugesagt.' : 'Tipp: Wenn du die App zum Startbildschirm hinzufügst, werden die Daten zuverlässiger aufbewahrt.'}</p>
    </section>`;

  // Design
  const seg = $('[data-theme-seg]', container);
  const markTheme = () => $$('button', seg).forEach((b) => b.classList.toggle('active', b.dataset.v === theme));
  markTheme();
  $$('button', seg).forEach((b) => {
    b.onclick = () => {
      theme = b.dataset.v;
      applyTheme(theme);
      markTheme();
    };
  });

  // Sicherung
  $('[data-download]', container).onclick = async () => {
    await downloadBackup();
    toast('Sicherung wurde heruntergeladen');
    renderSettings(container);
  };
  const shareBtn = $('[data-share]', container);
  if (shareBtn) {
    shareBtn.onclick = async () => {
      try {
        await shareBackup();
        toast('Sicherung geteilt');
        renderSettings(container);
      } catch (err) {
        if (err?.name !== 'AbortError') toast('Teilen hat nicht geklappt. Nutze „Sicherung herunterladen“.');
      }
    };
  }

  const fileIn = $('[data-file]', container);
  $('[data-restore]', container).onclick = () => fileIn.click();
  fileIn.onchange = async () => {
    const file = fileIn.files?.[0];
    fileIn.value = '';
    if (!file) return;
    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (err) {
      toast(err.message, { duration: 6000 });
      return;
    }
    const c = countRows(backup);
    const date = backup.exportedAt ? shortDate(backup.exportedAt.slice(0, 10)) : 'unbekannt';
    const ok = await confirmDialog({
      title: 'Sicherung wiederherstellen?',
      text: `Achtung: Alle aktuellen Daten auf diesem Gerät werden gelöscht und durch die Sicherung vom ${date} ersetzt (${num(c.entries)} Einträge, ${num(c.weights)} Gewichtswerte, ${num(c.recipes)} Gerichte). Das kann nicht rückgängig gemacht werden.`,
      ok: 'Ersetzen',
      danger: true
    });
    if (!ok) return;
    try {
      await restoreBackup(backup);
      toast('Sicherung wiederhergestellt');
      renderSettings(container);
    } catch (err) {
      console.error(err);
      toast(`Wiederherstellen fehlgeschlagen: ${err.message}`, { duration: 6000 });
    }
  };
}

export function applyTheme(theme) {
  try {
    if (theme === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', theme);
  } catch { /* egal */ }
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
