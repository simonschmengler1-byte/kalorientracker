// Datensicherung: Export als JSON-Datei und Wiederherstellung
import { db, TABLES, setSetting } from './db.js';
import { today } from './format.js';

const APP_ID = 'kalorientracker';

export async function buildBackup() {
  const data = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return {
    app: APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };
}

export function backupFileName() {
  return `kalorientracker-sicherung-${today()}.json`;
}

async function backupBlob() {
  const json = JSON.stringify(await buildBackup(), null, 1);
  return new Blob([json], { type: 'application/json' });
}

/** Sicherung als Datei herunterladen */
export async function downloadBackup() {
  const blob = await backupBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  await setSetting('lastBackup', new Date().toISOString());
}

/** Kann der Browser Dateien teilen (z. B. "In Dateien sichern" auf dem iPhone)? */
export function canShareFiles() {
  try {
    const f = new File(['{}'], 'test.json', { type: 'application/json' });
    return !!navigator.canShare?.({ files: [f] });
  } catch {
    return false;
  }
}

export async function shareBackup() {
  const blob = await backupBlob();
  const file = new File([blob], backupFileName(), { type: 'application/json' });
  await navigator.share({ files: [file], title: 'Kalorientracker-Sicherung' });
  await setSetting('lastBackup', new Date().toISOString());
}

/** Datei prüfen – wirft einen verständlichen Fehler, wenn sie nicht passt */
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist keine gültige Sicherung (kein lesbares JSON).');
  }
  if (!obj || obj.app !== APP_ID || typeof obj.data !== 'object') {
    throw new Error('Diese Datei ist keine Sicherung dieser App.');
  }
  for (const t of TABLES) {
    if (obj.data[t] != null && !Array.isArray(obj.data[t])) {
      throw new Error('Die Sicherung ist beschädigt.');
    }
  }
  return obj;
}

/** Alle aktuellen Daten durch die Sicherung ersetzen */
export async function restoreBackup(obj) {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = obj.data[t] || [];
      if (rows.length) await db.table(t).bulkPut(rows);
    }
  });
  // Die wiederhergestellten Daten sind ja gesichert
  await setSetting('lastBackup', new Date().toISOString());
}

export function countRows(obj) {
  const d = obj.data;
  return {
    entries: d.entries?.length ?? 0,
    foods: d.foods?.length ?? 0,
    recipes: d.recipes?.length ?? 0,
    weights: d.weights?.length ?? 0
  };
}
