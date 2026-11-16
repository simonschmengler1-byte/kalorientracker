// Zahlen und Datumswerte im deutschen Format

const nf = {};
function getNf(digits) {
  if (!nf[digits]) {
    nf[digits] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  }
  return nf[digits];
}

/** Zahl deutsch formatieren, z. B. 1234.5 -> "1.234,5" */
export function num(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return '–';
  return getNf(digits).format(value);
}

/** Eingabe wie "1,5" oder "1.5" in Zahl umwandeln. Leere/ungültige Eingabe -> null */
export function parseNum(text) {
  if (text == null) return null;
  let s = String(text).trim().replace(/\s/g, '');
  if (s === '') return null;
  // "1.234,5" -> "1234.5"; "1,5" -> "1.5"
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Wert für ein Eingabefeld (deutsch, ohne Tausenderpunkte) */
export function inputNum(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '';
  const r = Math.round(value * 10 ** digits) / 10 ** digits;
  return String(r).replace('.', ',');
}

// ---------- Datum ----------
export function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function today() { return isoDate(new Date()); }

export function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso, n) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function daysBetween(a, b) {
  return Math.round((parseIso(b) - parseIso(a)) / 86400000);
}

const weekdayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });
const weekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });
const dateShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dayMonthShort = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' });

/** "Heute", "Gestern", "Morgen" oder "Montag, 3. November" */
export function friendlyDate(iso) {
  const diff = daysBetween(today(), iso);
  if (diff === 0) return 'Heute';
  if (diff === -1) return 'Gestern';
  if (diff === 1) return 'Morgen';
  const d = parseIso(iso);
  return `${weekdayLong.format(d)}, ${dayMonth.format(d)}`;
}
export function shortDate(iso) { return dateShort.format(parseIso(iso)); }
export function dayMonthNum(iso) { return dayMonthShort.format(parseIso(iso)); }
export function weekdayAbbr(iso) { return weekdayShort.format(parseIso(iso)).replace('.', ''); }

/** HTML-Sonderzeichen entschärfen (für Texte aus dem Internet) */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
