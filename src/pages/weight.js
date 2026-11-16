// Gewicht: Eintragen, Liste, Liniendiagramm (eigenes SVG)
import { db, getSetting, setSetting } from '../db.js';
import { icons } from '../icons.js';
import { num, inputNum, parseNum, today, shortDate, dayMonthNum, parseIso } from '../format.js';
import { $, $$, toast, emptyState } from '../ui.js';

export async function renderWeight(container) {
  const list = await db.weights.orderBy('date').toArray();
  const target = await getSetting('targetWeight');
  const first = list[0];
  const last = list[list.length - 1];
  const diff = first && last ? last.kg - first.kg : null;

  container.innerHTML = `
    <h1 class="page-title">Gewicht</h1>

    <form class="card" data-add novalidate>
      <div class="card-title"><span>Gewicht eintragen</span></div>
      <div class="grid-2">
        <label class="field"><span>Gewicht</span><div class="input-suffix"><input class="input" name="kg" inputmode="decimal" placeholder="${last ? inputNum(last.kg, 1) : 'z. B. 72,5'}"><em>kg</em></div></label>
        <label class="field"><span>Datum</span><input class="input" type="date" name="date" value="${today()}" max="${today()}"></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Speichern</button>
    </form>

    ${list.length ? `
      <div class="stat-row">
        <div class="stat"><b class="tabular">${num(first.kg, 1)}</b><span>Start kg</span></div>
        <div class="stat"><b class="tabular">${num(last.kg, 1)}</b><span>Aktuell kg</span></div>
        <div class="stat"><b class="tabular ${diff < 0 ? 'down' : diff > 0 ? 'up' : ''}">${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${num(Math.abs(diff), 1)}</b><span>Veränderung kg</span></div>
      </div>
      <section class="card">
        <div class="card-title"><span>Verlauf</span>${target ? `<span class="card-sub">Ziel: ${num(target, 1)} kg</span>` : ''}</div>
        ${list.length >= 2 ? chartSvg(list, target) : '<p class="small muted">Trage an einem weiteren Tag dein Gewicht ein – dann siehst du hier deinen Verlauf als Kurve.</p>'}
      </section>` : `
      <section class="card">${emptyState(icons.weight, 'Noch kein Gewicht eingetragen', 'Trage oben dein aktuelles Gewicht ein. Am besten wiegst du dich immer zur gleichen Zeit, z. B. morgens nach dem Aufstehen.')}</section>`}

    <form class="card" data-target novalidate>
      <div class="card-title"><span>Zielgewicht (optional)</span></div>
      <div class="input-group">
        <div class="input-suffix"><input class="input" name="target" inputmode="decimal" placeholder="z. B. 68" value="${inputNum(target, 1)}"><em>kg</em></div>
        <button class="btn btn-outline" type="submit" style="flex:none">Speichern</button>
      </div>
      <p class="small muted" style="margin-top:8px">Wird im Diagramm als gestrichelte Linie angezeigt. Feld leeren und speichern, um es zu entfernen.</p>
    </form>

    ${list.length ? `
      <p class="section-label">Alle Einträge</p>
      <div class="list weight-list">
        ${[...list].reverse().map((w) => `
          <div class="list-item" data-id="${w.id}">
            <div class="list-item-main"><div class="list-item-title tabular">${num(w.kg, 1)} kg</div><div class="list-item-sub">${shortDate(w.date)}</div></div>
            <button type="button" class="icon-btn" data-del aria-label="Eintrag vom ${shortDate(w.date)} löschen">${icons.trash}</button>
          </div>`).join('')}
      </div>` : ''}`;

  const addForm = $('[data-add]', container);
  addForm.onsubmit = async (e) => {
    e.preventDefault();
    const kg = parseNum(addForm.kg.value);
    const date = addForm.date.value || today();
    if (!kg || kg < 20 || kg > 400) {
      toast('Bitte gib ein gültiges Gewicht ein, z. B. 72,5');
      return;
    }
    // Pro Tag nur ein Wert: vorhandenen ersetzen
    const existing = await db.weights.where('date').equals(date).first();
    if (existing) await db.weights.update(existing.id, { kg });
    else await db.weights.add({ date, kg });
    // Profilgewicht für den Rechner aktualisieren, wenn es der neueste Wert ist
    const newest = await db.weights.orderBy('date').last();
    if (newest?.date === date) {
      const profile = await getSetting('profile');
      if (profile) await setSetting('profile', { ...profile, weight: kg });
    }
    toast(existing ? 'Gewicht aktualisiert' : 'Gewicht gespeichert', { duration: 2500 });
    renderWeight(container);
  };

  const targetForm = $('[data-target]', container);
  targetForm.onsubmit = async (e) => {
    e.preventDefault();
    const v = parseNum(targetForm.target.value);
    await setSetting('targetWeight', v && v > 20 ? v : null);
    toast(v ? 'Zielgewicht gespeichert' : 'Zielgewicht entfernt', { duration: 2000 });
    renderWeight(container);
  };

  $$('[data-del]', container).forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.closest('[data-id]').dataset.id);
      const entry = await db.weights.get(id);
      await db.weights.delete(id);
      await renderWeight(container);
      toast(`Eintrag vom ${shortDate(entry.date)} gelöscht`, {
        action: 'Rückgängig',
        onAction: async () => {
          await db.weights.put(entry);
          renderWeight(container);
        }
      });
    };
  });
}

/** Liniendiagramm als SVG */
function chartSvg(list, target) {
  const W = 340;
  const H = 200;
  const pad = { l: 36, r: 12, t: 12, b: 26 };
  const t0 = parseIso(list[0].date).getTime();
  const t1 = parseIso(list[list.length - 1].date).getTime();
  const span = Math.max(t1 - t0, 86400000);
  const values = list.map((w) => w.kg);
  if (target) values.push(target);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const margin = Math.max((max - min) * 0.15, 0.5);
  min = Math.floor(min - margin);
  max = Math.ceil(max + margin);
  const x = (d) => pad.l + ((parseIso(d).getTime() - t0) / span) * (W - pad.l - pad.r);
  const y = (kg) => pad.t + (1 - (kg - min) / (max - min)) * (H - pad.t - pad.b);

  // Hilfslinien
  const steps = 4;
  const grid = Array.from({ length: steps + 1 }, (_, i) => {
    const v = min + ((max - min) * i) / steps;
    return `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${num(v, 1)}</text>`;
  }).join('');

  // Datumsbeschriftung: erster, mittlerer, letzter Punkt
  const labelIdx = [...new Set([0, Math.floor((list.length - 1) / 2), list.length - 1])];
  const labels = labelIdx.map((i, k) => {
    const anchor = k === 0 ? 'start' : k === labelIdx.length - 1 ? 'end' : 'middle';
    return `<text x="${x(list[i].date)}" y="${H - 6}" text-anchor="${anchor}">${dayMonthNum(list[i].date)}</text>`;
  }).join('');

  const pts = list.map((w) => `${x(w.date).toFixed(1)},${y(w.kg).toFixed(1)}`);
  const area = `M${pts[0]} L${pts.join(' L')} L${x(list[list.length - 1].date)},${H - pad.b} L${x(list[0].date)},${H - pad.b} Z`;
  const showDots = list.length <= 40;

  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf von ${num(list[0].kg, 1)} kg auf ${num(list[list.length - 1].kg, 1)} kg">
      ${grid}
      ${target ? `<line class="target-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(target)}" y2="${y(target)}"/><text class="target-label" x="${W - pad.r}" y="${y(target) - 5}" text-anchor="end">Ziel</text>` : ''}
      <path class="area" d="${area}"/>
      <polyline class="line" points="${pts.join(' ')}"/>
      ${showDots ? list.map((w) => `<circle class="dot" cx="${x(w.date)}" cy="${y(w.kg)}" r="3.5"/>`).join('') : ''}
      ${labels}
    </svg>`;
}
