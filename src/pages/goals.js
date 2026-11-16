// Ziele: Rechner nach Mifflin-St-Jeor + manuelle Anpassung
import { db, getSetting, setSetting } from '../db.js';
import { icons } from '../icons.js';
import { num, inputNum, parseNum } from '../format.js';
import { ACTIVITY, GOAL_TYPES, computeGoals, macrosFor } from '../calc.js';
import { getGoals } from '../store.js';
import { $, $$, toast } from '../ui.js';

export async function renderGoals(container) {
  const latestWeight = await db.weights.orderBy('date').last();
  const profile = {
    sex: 'female',
    age: 30,
    height: 170,
    weight: latestWeight?.kg ?? 70,
    activity: 'light',
    goalType: 'maintain',
    ...(await getSetting('profile', {}))
  };
  const goals = await getGoals();
  const hasGoals = !!(await getSetting('goals'));

  container.innerHTML = `
    <h1 class="page-title">Ziele</h1>

    <section class="card">
      <div class="card-title"><span>Dein Tagesziel</span>${hasGoals ? '' : '<span class="card-sub">noch nicht festgelegt</span>'}</div>
      <div class="stat-row" style="grid-template-columns:repeat(4,1fr);gap:8px">
        <div class="stat" style="margin:0;box-shadow:none;background:var(--accent-soft)"><b class="tabular" data-cur="kcal">${num(goals.kcal)}</b><span>kcal</span></div>
        <div class="stat" style="margin:0;box-shadow:none;background:var(--surface-2)"><b class="tabular">${num(goals.protein)}</b><span>Eiweiß g</span></div>
        <div class="stat" style="margin:0;box-shadow:none;background:var(--surface-2)"><b class="tabular">${num(goals.carbs)}</b><span>KH g</span></div>
        <div class="stat" style="margin:0;box-shadow:none;background:var(--surface-2)"><b class="tabular">${num(goals.fat)}</b><span>Fett g</span></div>
      </div>
    </section>

    <form class="card" data-calc novalidate>
      <div class="card-title"><span>Bedarf berechnen</span></div>
      <div class="field"><span class="field-label">Geschlecht</span>
        <div class="segmented" data-seg="sex">
          <button type="button" data-v="female">Weiblich</button>
          <button type="button" data-v="male">Männlich</button>
        </div>
      </div>
      <div class="grid-2" style="grid-template-columns:repeat(3,1fr)">
        <label class="field"><span>Alter</span><div class="input-suffix"><input class="input" name="age" inputmode="numeric" value="${inputNum(profile.age, 0)}"><em>J.</em></div></label>
        <label class="field"><span>Größe</span><div class="input-suffix"><input class="input" name="height" inputmode="decimal" value="${inputNum(profile.height, 0)}"><em>cm</em></div></label>
        <label class="field"><span>Gewicht</span><div class="input-suffix"><input class="input" name="weight" inputmode="decimal" value="${inputNum(profile.weight, 1)}"><em>kg</em></div></label>
      </div>
      <div class="field"><span class="field-label">Wie aktiv bist du?</span>
        <div class="options" data-opt="activity">
          ${ACTIVITY.map((a) => `<button type="button" class="option" data-v="${a.id}"><span class="dot"></span><span><b>${a.label}</b><small>${a.hint}</small></span></button>`).join('')}
        </div>
      </div>
      <div class="field"><span class="field-label">Was ist dein Ziel?</span>
        <div class="options" data-opt="goalType">
          ${GOAL_TYPES.map((g) => `<button type="button" class="option" data-v="${g.id}"><span class="dot"></span><span><b>${g.label}</b><small>${g.hint} pro Tag</small></span></button>`).join('')}
        </div>
      </div>
      <p class="small" data-error style="color:var(--danger);margin-bottom:10px" hidden></p>
      <div class="result-grid" data-result></div>
      <button class="btn btn-primary btn-block" type="submit">Als Ziel übernehmen</button>
    </form>

    <form class="card" data-manual novalidate>
      <div class="card-title"><span>Ziel selbst festlegen</span></div>
      <p class="small muted" style="margin-bottom:12px">Du kannst die Werte auch direkt eintragen, z. B. nach Absprache mit Ärztin, Arzt oder Ernährungsberatung.</p>
      <label class="field"><span>Kalorien pro Tag</span><div class="input-suffix"><input class="input" name="kcal" inputmode="numeric" value="${inputNum(goals.kcal, 0)}"><em>kcal</em></div></label>
      <div class="grid-2" style="grid-template-columns:repeat(3,1fr)">
        <label class="field"><span>Eiweiß</span><div class="input-suffix"><input class="input" name="protein" inputmode="numeric" value="${inputNum(goals.protein, 0)}"><em>g</em></div></label>
        <label class="field"><span>Kohlenh.</span><div class="input-suffix"><input class="input" name="carbs" inputmode="numeric" value="${inputNum(goals.carbs, 0)}"><em>g</em></div></label>
        <label class="field"><span>Fett</span><div class="input-suffix"><input class="input" name="fat" inputmode="numeric" value="${inputNum(goals.fat, 0)}"><em>g</em></div></label>
      </div>
      <p class="small muted" data-macro-kcal style="margin:-4px 0 12px"></p>
      <div class="btn-row">
        <button type="button" class="btn btn-outline" data-auto-macros>Makros automatisch</button>
        <button type="submit" class="btn btn-primary">Speichern</button>
      </div>
    </form>

    <section class="card explain">
      <div class="card-title" style="color:var(--text)"><span>${icons.info} Was bedeuten die Werte?</span></div>
      <p><b>Grundumsatz:</b> So viele Kalorien verbraucht dein Körper in völliger Ruhe – für Atmung, Herzschlag, Gehirn und Körperwärme. Er wird hier mit der bewährten Mifflin-St-Jeor-Formel aus Geschlecht, Alter, Größe und Gewicht geschätzt.</p>
      <p><b>Gesamtumsatz:</b> Grundumsatz plus alles, was du durch Bewegung, Arbeit und Sport zusätzlich verbrauchst. Isst du genau so viel, bleibt dein Gewicht etwa gleich.</p>
      <p><b>Tagesziel:</b> Gesamtumsatz plus bzw. minus deinem Ziel. 500 kcal weniger pro Tag entsprechen grob einem halben Kilo Fett pro Woche.</p>
      <p><b>Makros:</b> Eiweiß 1,8 g pro kg Körpergewicht, Fett 27 % der Kalorien, der Rest kommt aus Kohlenhydraten.</p>
      <p class="small">Die Werte sind Schätzungen. Beobachte dein Gewicht ein paar Wochen und passe das Ziel bei Bedarf an.</p>
    </section>`;

  // ----- Rechner -----
  const calcForm = $('[data-calc]', container);
  const resultBox = $('[data-result]', calcForm);
  const errEl = $('[data-error]', calcForm);

  function setChoice(group, value) {
    profile[group] = value;
    $$(`[data-seg="${group}"] button, [data-opt="${group}"] .option`, calcForm).forEach((b) => {
      b.classList.toggle('active', b.dataset.v === value);
      b.setAttribute('aria-pressed', String(b.dataset.v === value));
    });
    updateResult();
  }
  ['sex', 'activity', 'goalType'].forEach((g) => {
    $$(`[data-seg="${g}"] button, [data-opt="${g}"] .option`, calcForm).forEach((b) => {
      b.onclick = () => setChoice(g, b.dataset.v);
    });
    setChoice(g, profile[g]);
  });

  function readProfile() {
    const f = new FormData(calcForm);
    return {
      ...profile,
      age: parseNum(f.get('age')),
      height: parseNum(f.get('height')),
      weight: parseNum(f.get('weight'))
    };
  }
  function validate(p) {
    if (!p.age || p.age < 14 || p.age > 110) return 'Bitte gib ein Alter zwischen 14 und 110 Jahren ein.';
    if (!p.height || p.height < 120 || p.height > 230) return 'Bitte gib deine Größe in cm ein (z. B. 172).';
    if (!p.weight || p.weight < 30 || p.weight > 300) return 'Bitte gib dein Gewicht in kg ein (z. B. 72,5).';
    return '';
  }
  function updateResult() {
    const p = readProfile();
    const error = validate(p);
    if (error) {
      resultBox.innerHTML = '';
      return null;
    }
    errEl.hidden = true;
    const r = computeGoals(p);
    resultBox.innerHTML = `
      <div class="stat"><b class="tabular">${num(r.bmr)}</b><span>Grundumsatz kcal</span></div>
      <div class="stat"><b class="tabular">${num(r.tdee)}</b><span>Gesamtumsatz kcal</span></div>
      <div class="stat" style="grid-column:1/-1;background:var(--accent-soft)"><b class="tabular">${num(r.kcal)} kcal</b>
        <span>Eiweiß ${num(r.protein)} g · Kohlenhydrate ${num(r.carbs)} g · Fett ${num(r.fat)} g</span></div>`;
    return { p, r };
  }
  calcForm.addEventListener('input', updateResult);
  calcForm.onsubmit = async (e) => {
    e.preventDefault();
    const p = readProfile();
    const error = validate(p);
    if (error) {
      errEl.textContent = error;
      errEl.hidden = false;
      return;
    }
    const r = computeGoals(p);
    await setSetting('profile', p);
    await setSetting('goals', { kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat });
    toast(`Neues Tagesziel: ${num(r.kcal)} kcal`);
    await renderGoals(container);
  };

  // ----- Manuell -----
  const manual = $('[data-manual]', container);
  const macroKcal = $('[data-macro-kcal]', manual);
  const showMacroKcal = () => {
    const f = new FormData(manual);
    const k = (parseNum(f.get('protein')) || 0) * 4 + (parseNum(f.get('carbs')) || 0) * 4 + (parseNum(f.get('fat')) || 0) * 9;
    macroKcal.textContent = `Die Makros ergeben zusammen ${num(k)} kcal.`;
  };
  manual.addEventListener('input', showMacroKcal);
  showMacroKcal();
  $('[data-auto-macros]', manual).onclick = () => {
    const kcal = parseNum(manual.kcal.value);
    if (!kcal) return;
    const w = parseNum(calcForm.weight.value) || profile.weight || 70;
    const m = macrosFor(kcal, w);
    manual.protein.value = m.protein;
    manual.carbs.value = m.carbs;
    manual.fat.value = m.fat;
    showMacroKcal();
  };
  manual.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(manual);
    const g = {
      kcal: Math.round(parseNum(f.get('kcal')) || 0),
      protein: Math.round(parseNum(f.get('protein')) || 0),
      carbs: Math.round(parseNum(f.get('carbs')) || 0),
      fat: Math.round(parseNum(f.get('fat')) || 0)
    };
    if (g.kcal < 800 || g.kcal > 6000) {
      toast('Bitte gib ein Kalorienziel zwischen 800 und 6.000 kcal ein.');
      return;
    }
    await setSetting('goals', g);
    toast('Ziel gespeichert');
    await renderGoals(container);
  };
}
