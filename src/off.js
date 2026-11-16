// Open Food Facts: Barcode-Abfrage und Suche
const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_de,generic_name,brands,nutriments,serving_size,serving_quantity';

export class OffError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // 'offline' | 'timeout' | 'server'
  }
}

const OFFLINE_MSG = 'Keine Internetverbindung. Bitte prüfe WLAN oder mobile Daten und versuche es erneut.';
const BUSY_MSG = 'Open Food Facts antwortet gerade nicht (der kostenlose Dienst ist manchmal überlastet). Bitte in ein paar Sekunden erneut versuchen.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJsonOnce(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 404) return { status: 0 };
    if (!res.ok) throw new OffError('server', BUSY_MSG);
    return await res.json();
  } catch (err) {
    if (err instanceof OffError) throw err;
    if (err.name === 'AbortError') {
      throw new OffError('timeout', 'Die Abfrage dauert zu lange. Vielleicht ist die Verbindung schwach – bitte erneut versuchen.');
    }
    // Netzwerkfehler: entweder offline oder der Server hat ohne CORS-Kopfzeilen geantwortet (z. B. Fehler 503)
    throw new OffError(navigator.onLine ? 'server' : 'offline', navigator.onLine ? BUSY_MSG : OFFLINE_MSG);
  } finally {
    clearTimeout(timer);
  }
}

/** Abfrage mit automatischer Wiederholung, falls Open Food Facts kurz überlastet ist */
async function getJson(url, timeoutMs = 15000, attempts = 2) {
  if (!navigator.onLine) throw new OffError('offline', OFFLINE_MSG);
  for (let i = 1; ; i++) {
    try {
      return await getJsonOnce(url, timeoutMs);
    } catch (err) {
      if (err.kind !== 'server' || i >= attempts) throw err;
      await sleep(1500 * i);
    }
  }
}

function numOrNull(v) {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** OFF-Produkt in unser Lebensmittel-Format umwandeln */
export function normalizeProduct(p, code) {
  const n = p.nutriments || {};
  let kcal = numOrNull(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = numOrNull(n['energy-kj_100g']) ?? numOrNull(n.energy_100g);
    if (kj != null) kcal = Math.round(kj / 4.184);
  }
  const servingGrams = numOrNull(p.serving_quantity);
  const food = {
    barcode: String(p.code || code || ''),
    name: (p.product_name_de || p.product_name || p.generic_name || '').trim(),
    brand: (p.brands || '').split(',')[0].trim(),
    kcal,
    protein: numOrNull(n.proteins_100g),
    carbs: numOrNull(n.carbohydrates_100g),
    fat: numOrNull(n.fat_100g),
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : null,
    servingLabel: p.serving_size || '',
    source: 'off'
  };
  food.complete = !!food.name && food.kcal != null && food.protein != null && food.carbs != null && food.fat != null;
  return food;
}

/** Produkt per Barcode. Gibt null zurück, wenn nicht gefunden. */
export async function fetchByBarcode(code) {
  const data = await getJson(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (!data || data.status === 0 || !data.product) return null;
  return normalizeProduct(data.product, code);
}

const searchCache = new Map();

/** Suche nach Name – deutsche Produkte bevorzugt (Ergebnisse werden kurz zwischengespeichert) */
export async function searchProducts(query) {
  const key = query.toLowerCase();
  if (searchCache.has(key)) return searchCache.get(key);
  const result = await searchUncached(query);
  searchCache.set(key, result);
  return result;
}

async function searchUncached(query) {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '30',
    countries_tags_en: 'germany',
    lc: 'de',
    fields: FIELDS
  });
  const data = await getJson(`${BASE}/cgi/search.pl?${params}`, 20000);
  return (data.products || [])
    .map((p) => normalizeProduct(p))
    .filter((f) => f.name && f.kcal != null);
}
