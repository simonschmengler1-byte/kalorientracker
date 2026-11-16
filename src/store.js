// Datenzugriffe, die von mehreren Seiten genutzt werden
import { db, getSetting, setSetting } from './db.js';
import { DEFAULT_GOALS, scale } from './calc.js';
import { today, daysBetween } from './format.js';

export async function getGoals() {
  return { ...DEFAULT_GOALS, ...(await getSetting('goals', {})) };
}

export function entriesFor(date) {
  return db.entries.where('date').equals(date).sortBy('createdAt');
}

/** Nährwerte eines Eintrags aus Menge berechnen */
export function computeEntry(base, amount, unit) {
  const grams = unit === 'portion' ? amount * (base.servingGrams || 100) : amount;
  const n = scale(base.per100, grams);
  return { amount, unit, grams, ...n };
}

/** Lebensmittel speichern bzw. aktualisieren (OFF-Produkte werden per Barcode zwischengespeichert) */
export async function upsertFood(input) {
  const { complete, ...food } = input;
  if (food.id) {
    await db.foods.put(food);
    return food.id;
  }
  if (food.barcode) {
    const existing = await db.foods.where('barcode').equals(food.barcode).first();
    if (existing) {
      // eigene Werte haben Vorrang vor Open Food Facts
      if (existing.source === 'custom' && food.source === 'off') return existing.id;
      const merged = { ...existing, ...food, id: existing.id, favorite: existing.favorite ?? 0 };
      await db.foods.put(merged);
      return existing.id;
    }
  }
  return db.foods.add({ favorite: 0, lastUsed: 0, ...food });
}

/** Zuletzt verwendete Lebensmittel/Gerichte (ohne Doppelte) */
export async function recentItems(limit = 30) {
  const list = await db.entries.orderBy('createdAt').reverse().limit(300).toArray();
  const seen = new Set();
  const out = [];
  for (const e of list) {
    const key = e.refType === 'quick' ? `q:${e.name}:${Math.round(e.kcal)}` : `${e.refType}:${e.refId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** Soll an die Datensicherung erinnert werden? */
export async function backupReminderDue() {
  const last = await getSetting('lastBackup');
  const count = (await db.entries.count()) + (await db.weights.count());
  if (count === 0) return false;
  if (last) return daysBetween(last.slice(0, 10), today()) > 14;
  const first = await getSetting('firstUse', today());
  return daysBetween(first, today()) > 14;
}

export async function snoozeBackupReminder() {
  await setSetting('backupSnooze', today());
}
export async function backupSnoozedToday() {
  return (await getSetting('backupSnooze')) === today();
}
