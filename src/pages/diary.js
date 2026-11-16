// Tagebuch (Startseite)
import { db } from '../db.js';
import { icons } from '../icons.js';
import { num, today, addDays, friendlyDate, shortDate, esc } from '../format.js';
import { MEALS, sumNutrients, WATER_GLASS_ML, WATER_GOAL_ML } from '../calc.js';
import { getGoals, entriesFor, backupReminderDue, backupSnoozedToday, snoozeBackupReminder } from '../store.js';
import { $, $$, toast } from '../ui.js';
import { openAddFood, openEditEntry } from '../sheets/addFood.js';

let currentDate = today();
let lastSeenToday = today();

export async function renderDiary(container) {
  // Wurde die App über Mitternacht offen gelassen, zurück auf "Heute"
  if (lastSeenToday !== today()) {
    if (currentDate === lastSeenToday) currentDate = today();
    lastSeenToday = today();
  }
  container.className = 'page-diary';
  const draw = () => drawDiary(container, draw);
  await draw();
}

async function drawDiary(container, redraw) {
  const date = currentDate;
  const [goals, entries, water, showReminder] = await Promise.all([
    getGoals(),
    entriesFor(date),
    db.water.get(date),
    backupReminderDue().then(async (due) => due && !(await backupSnoozedToday()))
  ]);
  const total = sumNutrients(entries);
  const glasses = water?.glasses ?? 0;

  container.innerHTML = `
    ${showReminder ? reminderHtml() : ''}
    <div class="date-bar">
      <button type="button" class="icon-btn" data-act="prev" aria-label="Vorheriger Tag">${icons.left}</button>
      <button type="button" class="date-label" data-act="today" aria-label="Zu heute springen">
        ${esc(friendlyDate(date))}<small>${date === today() ? shortDate(date) : 'Tippen für Heute'}</small>
      </button>
      <button type="button" class="icon-btn" data-act="next" aria-label="Nächster Tag">${icons.right}</button>
    </div>
    ${summaryHtml(total, goals)}
    ${MEALS.map((m) => mealHtml(m, entries.filter((e) => e.meal === m.id))).join('')}
    ${waterHtml(glasses)}
  `;

  // Datum
  $('[data-act="prev"]', container).onclick = () => { currentDate = addDays(currentDate, -1); redraw(); };
  $('[data-act="next"]', container).onclick = () => { currentDate = addDays(currentDate, 1); redraw(); };
  $('[data-act="today"]', container).onclick = () => { currentDate = today(); redraw(); };

  // Sicherungs-Erinnerung
  const rem = $('[data-act="backup"]', container);
  if (rem) rem.onclick = () => { location.hash = '#/einstellungen'; };
  const snooze = $('[data-act="snooze"]', container);
  if (snooze) snooze.onclick = async () => { await snoozeBackupReminder(); redraw(); };

  // Mahlzeiten
  $$('[data-add]', container).forEach((btn) => {
    btn.onclick = () => openAddFood({ date, meal: btn.dataset.add, onChange: redraw });
  });

  const byId = new Map(entries.map((e) => [e.id, e]));
  $$('.entry', container).forEach((row) => {
    const entry = byId.get(Number(row.dataset.id));
    $('.entry-main', row).onclick = () => {
      if (row.dataset.swiped) return;
      openEditEntry(entry, { onChange: redraw });
    };
    $('[data-del]', row).onclick = () => removeEntry(entry, row, redraw);
    attachSwipe(row, () => removeEntry(entry, row, redraw));
  });

  // Wasser
  $$('.glass-btn', container).forEach((btn) => {
    btn.onclick = async () => {
      const i = Number(btn.dataset.i);
      // Antippen des letzten vollen Glases leert es wieder
      const next = i + 1 === glasses ? i : i + 1;
      await db.water.put({ date, glasses: next });
      redraw();
    };
  });
}

function reminderHtml() {
  return `
    <div class="banner" role="note">
      ${icons.alert}
      <div>
        <p><b>Zeit für eine Sicherung</b><br>Deine Daten liegen nur auf diesem Gerät. Deine letzte Sicherung ist über 14 Tage her.</p>
        <div class="btn-row" style="margin-top:6px">
          <button type="button" class="link-btn" data-act="backup">Jetzt sichern</button>
          <button type="button" class="link-btn muted" data-act="snooze" style="color:var(--text-2)">Später</button>
        </div>
      </div>
    </div>`;
}

function summaryHtml(total, goals) {
  const eaten = Math.round(total.kcal);
  const left = Math.round(goals.kcal - total.kcal);
  const r = 70;
  const c = 2 * Math.PI * r;
  const pct = goals.kcal > 0 ? Math.min(total.kcal / goals.kcal, 1) : 0;
  const over = left < 0;
  const macro = (label, key, color) => {
    const v = total[key];
    const g = goals[key];
    const p = g > 0 ? Math.min((v / g) * 100, 100) : 0;
    return `
      <div>
        <div class="macro-name">${label}</div>
        <div class="bar"><i style="width:${p}%;background:${v > g * 1.05 ? 'var(--danger)' : color}"></i></div>
        <div class="macro-val tabular"><b>${num(v)}</b> / ${num(g)} g</div>
      </div>`;
  };
  return `
    <section class="card summary" aria-label="Tagesübersicht">
      <div class="ring-row">
        <div class="ring-side"><b class="tabular">${num(eaten)}</b><span>gegessen</span></div>
        <div class="ring ${over ? 'over' : ''}">
          <svg viewBox="0 0 168 168" aria-hidden="true">
            <circle class="ring-track" cx="84" cy="84" r="${r}" fill="none" stroke-width="14"/>
            <circle class="ring-value" cx="84" cy="84" r="${r}" fill="none" stroke-width="14" stroke-linecap="round"
              stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
          </svg>
          <div class="ring-center">
            <b class="tabular">${num(Math.abs(left))}</b>
            <span>${over ? 'kcal zu viel' : 'kcal übrig'}</span>
          </div>
        </div>
        <div class="ring-side"><b class="tabular">${num(goals.kcal)}</b><span>Ziel</span></div>
      </div>
      <div class="macros">
        ${macro('Eiweiß', 'protein', 'var(--protein)')}
        ${macro('Kohlenhydrate', 'carbs', 'var(--carbs)')}
        ${macro('Fett', 'fat', 'var(--fat)')}
      </div>
    </section>`;
}

function amountText(e) {
  if (e.refType === 'quick') return 'Schnelleintrag';
  if (e.unit === 'portion') {
    const label = e.amount === 1 ? 'Portion' : 'Portionen';
    return `${num(e.amount, 2)} ${label} (${num(e.grams)} g)`;
  }
  return `${num(e.amount, 1)} g`;
}

function mealHtml(meal, list) {
  const kcal = list.reduce((s, e) => s + e.kcal, 0);
  return `
    <section class="card meal" data-meal="${meal.id}" style="padding:0">
      <div class="meal-head">
        <h3>${meal.label}</h3>
        <span class="meal-kcal tabular">${num(kcal)} kcal</span>
        <button type="button" class="icon-btn accent" data-add="${meal.id}" aria-label="${meal.label}: Essen hinzufügen">${icons.plus}</button>
      </div>
      ${list.length === 0
        ? `<p class="meal-empty">Noch nichts eingetragen – tippe auf „+“.</p>`
        : `<ul class="entry-list">${list.map(entryHtml).join('')}</ul>`}
    </section>`;
}

function entryHtml(e) {
  return `
    <li class="entry" data-id="${e.id}">
      <div class="entry-bg" aria-hidden="true">${icons.trash} Löschen</div>
      <div class="entry-fg">
        <button type="button" class="entry-main" aria-label="${esc(e.name)} bearbeiten">
          <div class="entry-name">${esc(e.name)}</div>
          <div class="entry-meta">${esc(e.brand ? `${e.brand} · ` : '')}${amountText(e)}</div>
        </button>
        <span class="entry-kcal tabular">${num(e.kcal)} kcal</span>
        <button type="button" class="icon-btn" data-del aria-label="${esc(e.name)} löschen">${icons.close}</button>
      </div>
    </li>`;
}

function waterHtml(glasses) {
  const goalGlasses = Math.ceil(WATER_GOAL_ML / WATER_GLASS_ML);
  const shown = Math.max(goalGlasses, glasses + 1);
  const liters = (glasses * WATER_GLASS_ML) / 1000;
  return `
    <section class="card" aria-label="Wasser">
      <div class="card-title">
        <span>Wasser</span>
        <span class="card-sub tabular"><span class="water-total">${num(liters, 2)}</span> / ${num(WATER_GOAL_ML / 1000, 1)} l</span>
      </div>
      <div class="water-glasses">
        ${Array.from({ length: shown }, (_, i) => `
          <button type="button" class="glass-btn ${i < glasses ? 'full' : ''}" data-i="${i}"
            aria-label="${i < glasses ? `Glas ${i + 1} (voll)` : `Glas ${i + 1} trinken`}">
            ${i < glasses ? icons.glassFilled : icons.glass}
          </button>`).join('')}
      </div>
      <p class="small muted" style="margin-top:8px">1 Glas = 250 ml. ${glasses >= goalGlasses ? 'Tagesziel erreicht – super!' : 'Tippe auf ein Glas, wenn du getrunken hast.'}</p>
    </section>`;
}

async function removeEntry(entry, row, redraw) {
  row.style.transition = 'opacity .2s';
  row.style.opacity = '0';
  await db.entries.delete(entry.id);
  await redraw();
  toast(`„${entry.name}“ gelöscht`, {
    action: 'Rückgängig',
    onAction: async () => {
      await db.entries.put(entry);
      redraw();
    }
  });
}

/** Nach links wischen zum Löschen */
function attachSwipe(row, onDelete) {
  const fg = $('.entry-fg', row);
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let tracking = false;
  let horizontal = null;

  fg.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dx = 0;
    tracking = true;
    horizontal = null;
    delete row.dataset.swiped;
  }, { passive: true });

  fg.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const mx = t.clientX - startX;
    const my = t.clientY - startY;
    if (horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      horizontal = Math.abs(mx) > Math.abs(my);
    }
    if (!horizontal) return;
    dx = Math.min(0, mx);
    fg.classList.add('dragging');
    fg.style.transform = `translateX(${dx}px)`;
  }, { passive: true });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    fg.classList.remove('dragging');
    if (horizontal && dx < -Math.min(110, row.offsetWidth * 0.3)) {
      row.dataset.swiped = '1';
      fg.style.transform = 'translateX(-100%)';
      setTimeout(onDelete, 150);
    } else {
      if (horizontal && Math.abs(dx) > 8) {
        row.dataset.swiped = '1';
        setTimeout(() => delete row.dataset.swiped, 300);
      }
      fg.style.transform = '';
    }
  };
  fg.addEventListener('touchend', end);
  fg.addEventListener('touchcancel', end);
}
