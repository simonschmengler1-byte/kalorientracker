// Datenbank im Browser (IndexedDB) über Dexie
import Dexie from 'dexie';

export const db = new Dexie('kalorientracker');

db.version(1).stores({
  foods: '++id, barcode, name, source, favorite, lastUsed',
  recipes: '++id, name, favorite, lastUsed',
  entries: '++id, date, meal, [refType+refId], createdAt',
  water: 'date',
  weights: '++id, date',
  settings: 'key'
});

export const TABLES = ['foods', 'recipes', 'entries', 'water', 'weights', 'settings'];

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}
export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

/** Persistenten Speicher anfragen, damit der Browser die Daten nicht einfach löscht */
export async function requestPersist() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* egal */ }
}
