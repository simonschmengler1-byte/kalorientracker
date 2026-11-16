// Statistik: Wochenansicht
import { db } from '../db.js';
import { icons } from '../icons.js';
import { num, today, addDays, weekdayAbbr, dayMonthNum } from '../format.js';
import { getGoals } from '../store.js';
import { $, emptyState } from '../ui.js';

let endDate = today();

export async function renderStats(container) {
  const start = addDays(endDate, -6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [entries, goals] = await Promise.all([
    db.entries.where('date').between(start, endDate, true, true).toArray(),
    getGoals()
  ]);
  const perDay = days.map((d) => {
    const list = entries.filter((e) => e.date === d);
    return {
      date: d,
      count: list.length,
      kcal: list.reduce((s, e) => s + e.kcal, 0),
      protein: list.reduce((s, e) => s + e.protein, 0),
      carbs: list.reduce((s, e) => s + e.carbs, 0),
      fat: list.reduce((s, e) => s + e.fat, 0)
    };
  });
  const tracked = perDay.filter((d) => d.count > 0);
  const avg = (k) => (tracked.length ? tracked.reduce((s, d) => s + d[k], 0) / tracked.length : 0);
  const isCurrentWeek = endDate === today();

  container.innerHTML = `
    <h1 class="page-title">Statistik</h1>
    <div class="date-bar">
      <button type="button" class="icon-btn" data-act="prev" aria-label="Vorherige 7 Tage">${icons.left}</button>
      <button type="button" class="date-label" data-act="now">${isCurrentWeek ? 'Letzte 7 Tage' : `${dayMonthNum(start)} – ${dayMonthNum(endDate)}`}<small>${isCurrentWeek ? `${dayMonthNum(start)} – ${dayMonthNum(endDate)}` : 'Tippen für aktuelle Woche'}</small></button>
      <button type="button" class="icon-btn" data-act="next" aria-label="Nächste 7 Tage" ${isCurrentWeek ? 'disabled style="opacity:.3"' : ''}>${icons.right}</button>
    </div>

    <div class="stat-row two">
      <div class="stat"><b class="tabular">${tracked.length ? num(avg('kcal')) : '–'}</b><span>Ø kcal pro Tag</span></div>
      <div class="stat"><b class="tabular">${tracked.length ? `${num(avg('protein'))} g` : '–'}</b><span>Ø Eiweiß pro Tag</span></div>
    </div>

    <section class="card">
      <div class="card-title"><span>Kalorien pro Tag</span><span class="card-sub">Ziel ${num(goals.kcal)} kcal</span></div>
      ${barChart(perDay, goals.kcal)}
      <p class="small muted" style="margin-top:8px">Der Durchschnitt zählt nur Tage, an denen du etwas eingetragen hast (${tracked.length} von 7).</p>
    </section>

    ${tracked.length ? `
      <section class="card">
        <div class="card-title"><span>Durchschnitt Makros</span></div>
        <div class="nutri-grid" style="grid-template-columns:repeat(3,1fr)">
          <div><b class="tabular" style="color:var(--protein)">${num(avg('protein'))} g</b><span>Eiweiß<br>Ziel ${num(goals.protein)} g</span></div>
          <div><b class="tabular" style="color:var(--carbs)">${num(avg('carbs'))} g</b><span>Kohlenh.<br>Ziel ${num(goals.carbs)} g</span></div>
          <div><b class="tabular" style="color:var(--fat)">${num(avg('fat'))} g</b><span>Fett<br>Ziel ${num(goals.fat)} g</span></div>
        </div>
      </section>` : `<section class="card">${emptyState(icons.stats, 'Noch keine Daten in dieser Woche', 'Sobald du Mahlzeiten im Tagebuch einträgst, siehst du hier deine Woche auf einen Blick.')}</section>`}`;

  $('[data-act="prev"]', container).onclick = () => { endDate = addDays(endDate, -7); renderStats(container); };
  $('[data-act="next"]', container).onclick = () => {
    if (isCurrentWeek) return;
    const n = addDays(endDate, 7);
    endDate = n > today() ? today() : n;
    renderStats(container);
  };
  $('[data-act="now"]', container).onclick = () => { endDate = today(); renderStats(container); };
}

function barChart(perDay, goal) {
  const W = 340;
  const H = 200;
  const pad = { l: 38, r: 8, t: 14, b: 34 };
  const maxVal = Math.max(goal * 1.2, ...perDay.map((d) => d.kcal), 100);
  const niceMax = Math.ceil(maxVal / 500) * 500;
  const y = (v) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const slot = (W - pad.l - pad.r) / perDay.length;
  const bw = Math.min(30, slot * 0.6);

  const gridVals = [0, niceMax / 2, niceMax];
  const grid = gridVals.map((v) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`).join('');

  const bars = perDay.map((d, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const h = Math.max(d.kcal > 0 ? 3 : 0, (H - pad.t - pad.b) * (d.kcal / niceMax));
    const cls = d.kcal === 0 ? 'bar-empty' : d.kcal > goal * 1.05 ? 'bar-over' : 'bar-ok';
    const isToday = d.date === today();
    return `
      ${d.kcal === 0 ? `<rect class="bar-empty" x="${cx - bw / 2}" y="${y(0) - 3}" width="${bw}" height="3" rx="1.5"/>` : `<rect class="${cls}" x="${cx - bw / 2}" y="${y(0) - h}" width="${bw}" height="${h}" rx="6"><title>${num(d.kcal)} kcal</title></rect>`}
      ${d.kcal > 0 ? `<text x="${cx}" y="${y(0) - h - 4}" text-anchor="middle" style="font-size:9.5px">${num(d.kcal)}</text>` : ''}
      <text x="${cx}" y="${H - 18}" text-anchor="middle" style="${isToday ? 'font-weight:700;fill:var(--text)' : ''}">${weekdayAbbr(d.date)}</text>
      <text x="${cx}" y="${H - 5}" text-anchor="middle" style="font-size:9.5px">${dayMonthNum(d.date)}</text>`;
  }).join('');

  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kalorien der letzten 7 Tage">
      ${grid}
      ${bars}
      <line class="goal-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(goal)}" y2="${y(goal)}"/>
    </svg>`;
}
