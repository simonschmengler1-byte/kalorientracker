// "Essen hinzufügen": Suche, Tabs, Detailansicht, Schnelleintrag, eigenes Lebensmittel
import { db } from '../db.js';
import { icons } from '../icons.js';
import { num, inputNum, parseNum, esc } from '../format.js';
import { MEALS, mealLabel, mealForNow } from '../calc.js';
import { computeEntry, upsertFood, recentItems } from '../store.js';
import { searchProducts } from '../off.js';
import { $, $$, openSheet, toast, confirmDialog, emptyState } from '../ui.js';
import { recipeEditorView } from './recipe.js';

const TABS = [
  { id: 'recent', label: 'Zuletzt' },
  { id: 'favorites', label: 'Favoriten' },
  { id: 'custom', label: 'Eigene Lebensmittel' },
  { id: 'recipes', label: 'Eigene Gerichte' }
];

// ---------- Öffnen ----------

/** Fenster "Essen hinzufügen" für ein Datum und eine Mahlzeit */
export function openAddFood({ date, meal, onChange }) {
  const ctx = { mode: 'diary', date, meal: meal || mealForNow(), onChange, browser: { tab: 'recent', query: '' } };
  openSheet(browserView(ctx));
}

/** Vorhandenen Eintrag bearbeiten */
export function openEditEntry(entry, { onChange }) {
  const ctx = { mode: 'diary', date: entry.date, meal: entry.meal, onChange, browser: { tab: 'recent', query: '' } };
  if (entry.refType === 'quick') openSheet(quickView(ctx, entry));
  else openSheet(detailView(ctx, baseFromEntry(entry), entry));
}

/** Auswahlfenster für Zutaten (eigene Gerichte) – onPick(food) */
export function pickerView(onPick) {
  const ctx = { mode: 'pick', onPick, browser: { tab: 'recent', query: '' } };
  return browserView(ctx);
}

// ---------- Hilfen ----------

export function baseFromFood(food) {
  return {
    refType: 'food',
    refId: food.id ?? null,
    food,
    name: food.name,
    brand: food.brand || '',
    per100: { kcal: food.kcal || 0, protein: food.protein || 0, carbs: food.carbs || 0, fat: food.fat || 0 },
    servingGrams: food.servingGrams || null,
    servingLabel: food.servingLabel || ''
  };
}
function baseFromRecipe(recipe) {
  return {
    refType: 'recipe',
    refId: recipe.id,
    recipe,
    name: recipe.name,
    brand: '',
    per100: recipe.per100,
    servingGrams: recipe.totalGrams / Math.max(recipe.portions, 1),
    servingLabel: '1 Portion'
  };
}
function baseFromEntry(e) {
  return {
    refType: e.refType,
    refId: e.refId,
    name: e.name,
    brand: e.brand || '',
    per100: e.per100,
    servingGrams: e.servingGrams || null,
    servingLabel: e.servingLabel || ''
  };
}

function foodSub(f) {
  const parts = [];
  if (f.brand) parts.push(f.brand);
  if (f.servingGrams) parts.push(`Portion ${num(f.servingGrams)} g`);
  return parts.join(' · ') || 'pro 100 g';
}

function foodRow(f, { star = false } = {}) {
  return `
    <div class="list-item" data-food="${f.id ?? ''}">
      <button type="button" class="list-item-main">
        <div class="list-item-title">${esc(f.name)}</div>
        <div class="list-item-sub">${esc(foodSub(f))}</div>
      </button>
      <span class="list-item-kcal tabular">${num(f.kcal)} kcal<br><small class="muted" style="font-weight:500">100 g</small></span>
      ${star ? `<span class="icon-btn fav" aria-hidden="true">${icons.starFilled}</span>` : `<span class="icon-btn quick-add" aria-hidden="true">${icons.right}</span>`}
    </div>`;
}

function recipeRow(r) {
  const perPortion = (r.per100.kcal * r.totalGrams) / 100 / Math.max(r.portions, 1);
  return `
    <div class="list-item" data-recipe="${r.id}">
      <button type="button" class="list-item-main">
        <div class="list-item-title">${esc(r.name)}</div>
        <div class="list-item-sub">${r.items.length} Zutaten · ${num(r.portions)} ${r.portions === 1 ? 'Portion' : 'Portionen'}</div>
      </button>
      <span class="list-item-kcal tabular">${num(perPortion)} kcal<br><small class="muted" style="font-weight:500">pro Portion</small></span>
      <button type="button" class="icon-btn" data-edit-recipe="${r.id}" aria-label="${esc(r.name)} bearbeiten">${icons.edit}</button>
    </div>`;
}

// ---------- Hauptansicht: Suche + Tabs ----------

function browserView(ctx) {
  const st = ctx.browser;
  let searchTimer = null;
  let searchToken = 0;
  return {
    title: ctx.mode === 'pick' ? 'Zutat auswählen' : 'Essen hinzufügen',
    onLeave() { clearTimeout(searchTimer); },
    render(body, sheet) {
      const tabs = ctx.mode === 'pick' ? TABS.filter((t) => t.id !== 'recipes') : TABS;
      body.innerHTML = `
        ${ctx.mode === 'diary' ? `
          <label class="field meal-select"><span>Mahlzeit</span>
            <select class="input" data-meal>${MEALS.map((m) => `<option value="${m.id}" ${m.id === ctx.meal ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
          </label>` : ''}
        <form class="search-row" role="search">
          <div class="search-box">${icons.search}
            <input class="input" type="search" enterkeyhint="search" placeholder="Lebensmittel suchen …" aria-label="Lebensmittel suchen" value="${esc(st.query)}" autocomplete="off">
          </div>
          <button type="button" class="icon-btn accent" data-scan aria-label="Barcode scannen">${icons.barcode}</button>
        </form>
        <div class="btn-row" style="margin-bottom:14px" data-actions>
          ${ctx.mode === 'diary' ? `<button type="button" class="btn btn-outline" data-quick>${icons.bolt} Schnelleintrag</button>` : ''}
          <button type="button" class="btn btn-outline" data-newfood>${icons.plus} Eigenes Lebensmittel</button>
        </div>
        <div class="chip-row" role="tablist">${tabs.map((t) => `<button type="button" role="tab" class="chip ${t.id === st.tab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
        <div data-content></div>`;

      const input = $('input[type="search"]', body);
      const content = $('[data-content]', body);
      const chips = $('.chip-row', body);
      const actions = $('[data-actions]', body);

      const mealSel = $('[data-meal]', body);
      if (mealSel) mealSel.onchange = () => { ctx.meal = mealSel.value; };

      $('[data-scan]', body).onclick = async () => {
        // Scanner-Bibliothek erst bei Bedarf laden (schnellerer App-Start)
        const { scannerView } = await import('./scanner.js');
        sheet.push(scannerView(ctx, { detailView, customFoodView }));
      };
      $('[data-newfood]', body).onclick = () => sheet.push(customFoodView(ctx, {}));
      const quick = $('[data-quick]', body);
      if (quick) quick.onclick = () => sheet.push(quickView(ctx));

      $$('[data-tab]', body).forEach((b) => {
        b.onclick = () => {
          st.tab = b.dataset.tab;
          $$('[data-tab]', body).forEach((x) => x.classList.toggle('active', x === b));
          showTab();
        };
      });

      const runSearch = () => {
        const q = input.value.trim();
        st.query = q;
        clearTimeout(searchTimer);
        if (!q) {
          chips.hidden = false;
          actions.hidden = false;
          showTab();
          return;
        }
        chips.hidden = true;
        actions.hidden = true;
        showSearch(q);
      };
      input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        if (!input.value.trim()) return runSearch();
        searchTimer = setTimeout(runSearch, 600);
      });
      $('form', body).onsubmit = (e) => {
        e.preventDefault();
        input.blur();
        runSearch();
      };

      if (st.query) runSearch();
      else showTab();

      // ----- Tabs -----
      async function showTab() {
        const tab = st.tab;
        let html = '';
        if (tab === 'recent') {
          const list = (await recentItems()).filter((e) => ctx.mode !== 'pick' || e.refType === 'food');
          html = list.length
            ? `<div class="list">${list.map(recentRow).join('')}</div>`
            : emptyState(icons.clock, 'Noch nichts eingetragen', 'Hier erscheinen die Lebensmittel, die du zuletzt gegessen hast – so trägst du sie mit einem Tipp erneut ein.');
        } else if (tab === 'favorites') {
          const foods = await db.foods.where('favorite').equals(1).sortBy('name');
          const recipes = ctx.mode === 'pick' ? [] : await db.recipes.where('favorite').equals(1).sortBy('name');
          html = foods.length + recipes.length
            ? `<div class="list">${recipes.map(recipeRow).join('')}${foods.map((f) => foodRow(f, { star: true })).join('')}</div>`
            : emptyState(icons.star, 'Noch keine Favoriten', 'Öffne ein Lebensmittel und tippe auf den Stern ☆ – dann findest du es hier sofort wieder.');
        } else if (tab === 'custom') {
          const foods = await db.foods.where('source').equals('custom').sortBy('name');
          html = foods.length
            ? `<div class="list">${foods.map((f) => foodRow(f)).join('')}</div>`
            : emptyState(icons.apple, 'Noch keine eigenen Lebensmittel', 'Lege Lebensmittel mit den Werten von der Packung an – z. B. wenn ein Barcode nicht gefunden wird. Tippe dazu oben auf „Eigenes Lebensmittel“.');
        } else if (tab === 'recipes') {
          const recipes = await db.recipes.orderBy('name').toArray();
          html = `
            <button type="button" class="btn btn-primary btn-block" data-newrecipe style="margin-bottom:14px">${icons.pot} Neues Gericht erstellen</button>
            ${recipes.length
              ? `<div class="list">${recipes.map(recipeRow).join('')}</div>`
              : emptyState(icons.pot, 'Noch keine eigenen Gerichte', 'Fasse mehrere Lebensmittel zu einem Gericht zusammen – z. B. „Chili con Carne“ oder „Proteinshake“ – und trage es dann portionsweise ein.')}`;
        }
        if (st.tab !== tab || st.query) return; // inzwischen gewechselt
        content.innerHTML = html;
        bindRows(content);
        const nr = $('[data-newrecipe]', content);
        if (nr) nr.onclick = () => sheet.push(recipeEditorView(ctx, null, { pickerView }));
      }

      function recentRow(e) {
        const unit = e.unit === 'portion' ? `${num(e.amount, 2)} Port.` : e.unit === 'g' ? `${num(e.amount)} g` : '';
        const key = e.refType === 'quick' ? `quick:${e.id}` : `${e.refType}:${e.refId}`;
        return `
          <div class="list-item" data-recent="${key}">
            <button type="button" class="list-item-main">
              <div class="list-item-title">${esc(e.name)}</div>
              <div class="list-item-sub">${esc([e.brand, unit || (e.refType === 'quick' ? 'Schnelleintrag' : '')].filter(Boolean).join(' · '))}</div>
            </button>
            <span class="list-item-kcal tabular">${num(e.kcal)} kcal</span>
            ${ctx.mode === 'diary' ? `<button type="button" class="icon-btn accent" data-readd aria-label="${esc(e.name)} erneut eintragen">${icons.plus}</button>` : ''}
          </div>`;
      }

      // ----- Suche -----
      async function showSearch(q) {
        const token = ++searchToken;
        const lower = q.toLowerCase();
        const localFoods = (await db.foods.toArray()).filter((f) => `${f.name} ${f.brand}`.toLowerCase().includes(lower)).slice(0, 15);
        const localRecipes = ctx.mode === 'pick' ? [] : (await db.recipes.toArray()).filter((r) => r.name.toLowerCase().includes(lower));
        if (token !== searchToken) return;
        const localHtml = localFoods.length + localRecipes.length
          ? `<p class="section-label">Gespeichert</p><div class="list">${localRecipes.map(recipeRow).join('')}${localFoods.map((f) => foodRow(f, { star: !!f.favorite })).join('')}</div>`
          : '';
        content.innerHTML = `${localHtml}<p class="section-label">Open Food Facts</p><div data-remote><div class="loading"><div class="spinner"></div>Suche läuft …</div></div>`;
        bindRows(content);
        const remote = $('[data-remote]', content);
        try {
          const results = await searchProducts(q);
          if (token !== searchToken) return;
          ctx.lastResults = results;
          remote.innerHTML = results.length
            ? `<div class="list">${results.map((f, i) => foodRow({ ...f, id: `r${i}` })).join('')}</div>`
            : `${emptyState(icons.search, 'Nichts gefunden', `Zu „${esc(q)}“ gibt es bei Open Food Facts keine Treffer. Versuche einen anderen Begriff oder lege das Lebensmittel selbst an.`)}
               <button type="button" class="btn btn-outline btn-block" data-newfood2>${icons.plus} Eigenes Lebensmittel anlegen</button>`;
          bindRows(remote);
          const nf = $('[data-newfood2]', remote);
          if (nf) nf.onclick = () => sheet.push(customFoodView(ctx, { name: q }));
        } catch (err) {
          if (token !== searchToken) return;
          remote.innerHTML = `
            <div class="error-box">${icons.alert}<div><p><b>Suche nicht möglich</b><br>${esc(err.message)}</p>
            <button type="button" class="link-btn" data-retry>Erneut versuchen</button></div></div>
            <p class="small muted" style="text-align:center">Gespeicherte Lebensmittel, Favoriten und eigene Gerichte funktionieren auch ohne Internet.</p>`;
          $('[data-retry]', remote).onclick = () => showSearch(q);
        }
      }

      // ----- Klicks auf Listeneinträge -----
      function bindRows(root) {
        $$('[data-food]', root).forEach((row) => {
          if (row.dataset.bound) return;
          row.dataset.bound = '1';
          row.onclick = async () => {
            const id = row.dataset.food;
            const food = id.startsWith('r') ? ctx.lastResults[Number(id.slice(1))] : await db.foods.get(Number(id));
            if (!food) return;
            if (ctx.mode === 'pick') return ctx.onPick(food);
            sheet.push(detailView(ctx, baseFromFood(food)));
          };
        });
        $$('[data-recipe]', root).forEach((row) => {
          if (row.dataset.bound) return;
          row.dataset.bound = '1';
          row.onclick = async (e) => {
            const recipe = await db.recipes.get(Number(row.dataset.recipe));
            if (!recipe) return;
            if (e.target.closest('[data-edit-recipe]')) return sheet.push(recipeEditorView(ctx, recipe, { pickerView }));
            sheet.push(detailView(ctx, baseFromRecipe(recipe)));
          };
        });
        $$('[data-recent]', root).forEach((row) => {
          if (row.dataset.bound) return;
          row.dataset.bound = '1';
          row.onclick = async (e) => {
            const [type, idStr] = row.dataset.recent.split(':');
            const id = Number(idStr);
            const readd = e.target.closest('[data-readd]');
            if (type === 'quick') {
              const prev = await db.entries.get(id);
              if (!prev) return;
              if (readd) return addCopy(prev);
              return sheet.push(quickView(ctx, { ...prev, id: undefined }));
            }
            const item = type === 'recipe' ? await db.recipes.get(id) : await db.foods.get(id);
            if (!item) {
              toast('Dieses Lebensmittel wurde gelöscht.');
              return;
            }
            if (ctx.mode === 'pick') return ctx.onPick(item);
            const base = type === 'recipe' ? baseFromRecipe(item) : baseFromFood(item);
            if (readd) {
              const prev = await db.entries.where('[refType+refId]').equals([type, id]).last();
              const c = computeEntry(base, prev.amount, prev.unit);
              await saveEntry(ctx, base, c);
              toast(`${base.name} zu ${mealLabel(ctx.meal)} hinzugefügt`);
              return;
            }
            sheet.push(detailView(ctx, base));
          };
        });
      }

      async function addCopy(prev) {
        const { id, ...rest } = prev;
        await db.entries.add({ ...rest, date: ctx.date, meal: ctx.meal, createdAt: Date.now() });
        ctx.onChange?.();
        toast(`${prev.name} zu ${mealLabel(ctx.meal)} hinzugefügt`);
      }
    }
  };
}

// ---------- Eintrag speichern ----------

async function saveEntry(ctx, base, c, existing = null) {
  let refId = base.refId;
  if (base.refType === 'food') {
    if (!refId) refId = await upsertFood(base.food);
    await db.foods.update(refId, { lastUsed: Date.now() });
  } else if (base.refType === 'recipe') {
    await db.recipes.update(refId, { lastUsed: Date.now() });
  }
  const entry = {
    date: ctx.date,
    meal: ctx.meal,
    name: base.name,
    brand: base.brand,
    refType: base.refType,
    refId,
    per100: base.per100,
    servingGrams: base.servingGrams,
    servingLabel: base.servingLabel,
    amount: c.amount,
    unit: c.unit,
    grams: c.grams,
    kcal: c.kcal,
    protein: c.protein,
    carbs: c.carbs,
    fat: c.fat,
    createdAt: existing?.createdAt ?? Date.now()
  };
  if (existing) await db.entries.put({ ...entry, id: existing.id });
  else await db.entries.add(entry);
  ctx.onChange?.();
}

// ---------- Detailansicht mit Mengeneingabe ----------

export function detailView(ctx, base, existing = null) {
  return {
    title: existing ? 'Eintrag bearbeiten' : 'Menge wählen',
    async render(body, sheet) {
      // Favoriten-Status
      let favTarget = null; // { table, id }
      let isFav = false;
      if (base.refType === 'food') {
        let food = base.food ?? (base.refId ? await db.foods.get(base.refId) : null);
        if (food && !food.id && food.barcode) {
          const saved = await db.foods.where('barcode').equals(food.barcode).first();
          if (saved) food = saved;
        }
        if (food) {
          base.food = food;
          if (food.id) base.refId = food.id;
          isFav = !!food.favorite;
          favTarget = { table: 'foods' };
        }
      } else if (base.refType === 'recipe' && base.refId) {
        const r = await db.recipes.get(base.refId);
        if (r) {
          isFav = !!r.favorite;
          favTarget = { table: 'recipes' };
        }
      }

      // Vorbelegung: bestehender Eintrag > letzte Menge > Portion > 100 g
      let amount = 100;
      let unit = 'g';
      if (existing) {
        amount = existing.amount;
        unit = existing.unit;
      } else {
        const prev = base.refId ? await db.entries.where('[refType+refId]').equals([base.refType, base.refId]).last() : null;
        if (prev && (prev.unit === 'g' || base.servingGrams)) {
          amount = prev.amount;
          unit = prev.unit;
        } else if (base.servingGrams) {
          amount = 1;
          unit = 'portion';
        }
      }

      const isCustom = base.refType === 'food' && base.food?.source === 'custom';
      body.innerHTML = `
        <div class="detail-head">
          <div>
            <h3>${esc(base.name)}</h3>
            ${base.brand ? `<div class="brand">${esc(base.brand)}</div>` : ''}
          </div>
          ${favTarget ? `<button type="button" class="icon-btn ${isFav ? 'fav' : ''}" data-fav aria-pressed="${isFav}" aria-label="${isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">${isFav ? icons.starFilled : icons.star}</button>` : ''}
        </div>
        <section class="card">
          <div class="amount-row">
            <label class="field"><span>Menge</span>
              <input class="input tabular" data-amount inputmode="decimal" autocomplete="off" value="${inputNum(amount, 2)}">
            </label>
            <label class="field"><span>Einheit</span>
              <select class="input" data-unit>
                <option value="g" ${unit === 'g' ? 'selected' : ''}>Gramm (g / ml)</option>
                ${base.servingGrams ? `<option value="portion" ${unit === 'portion' ? 'selected' : ''}>Portion (${num(base.servingGrams)} g)</option>` : ''}
              </select>
            </label>
          </div>
          <div class="nutri-grid" data-grid></div>
          <p class="per100">Pro 100 g: ${num(base.per100.kcal)} kcal · ${num(base.per100.protein, 1)} g Eiweiß · ${num(base.per100.carbs, 1)} g KH · ${num(base.per100.fat, 1)} g Fett</p>
        </section>
        ${ctx.mode === 'diary' ? `
          <label class="field"><span>Mahlzeit</span>
            <select class="input" data-meal>${MEALS.map((m) => `<option value="${m.id}" ${m.id === ctx.meal ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
          </label>` : ''}
        ${isCustom ? `<button type="button" class="btn btn-outline btn-block" data-editfood style="margin-bottom:10px">${icons.edit} Lebensmittel bearbeiten</button>` : ''}
        <div class="sticky-actions">
          <button type="button" class="btn btn-primary btn-block" data-save>${existing ? 'Speichern' : 'Hinzufügen'}</button>
          ${existing ? `<button type="button" class="btn btn-ghost btn-block" data-delete style="color:var(--danger);margin-top:6px">${icons.trash} Eintrag löschen</button>` : ''}
        </div>`;

      const amountIn = $('[data-amount]', body);
      const unitSel = $('[data-unit]', body);
      const grid = $('[data-grid]', body);
      const saveBtn = $('[data-save]', body);

      const update = () => {
        const a = parseNum(amountIn.value);
        const valid = a != null && a > 0;
        saveBtn.disabled = !valid;
        const c = computeEntry(base, valid ? a : 0, unitSel.value);
        grid.innerHTML = `
          <div class="k"><b class="tabular">${num(c.kcal)}</b><span>kcal</span></div>
          <div><b class="tabular">${num(c.protein, 1)}</b><span>Eiweiß g</span></div>
          <div><b class="tabular">${num(c.carbs, 1)}</b><span>Kohlenh. g</span></div>
          <div><b class="tabular">${num(c.fat, 1)}</b><span>Fett g</span></div>`;
        return valid ? c : null;
      };
      amountIn.addEventListener('input', update);
      amountIn.addEventListener('focus', () => amountIn.select());
      unitSel.onchange = () => {
        // Sinnvolle Menge beim Umschalten
        const a = parseNum(amountIn.value) || 0;
        if (unitSel.value === 'portion') amountIn.value = inputNum(Math.max(Math.round((a / base.servingGrams) * 4) / 4, 0.25), 2);
        else amountIn.value = inputNum(a * (base.servingGrams || 1), 0);
        update();
      };
      update();

      const mealSel = $('[data-meal]', body);
      if (mealSel) mealSel.onchange = () => { ctx.meal = mealSel.value; };

      const fav = $('[data-fav]', body);
      if (fav) {
        fav.onclick = async () => {
          isFav = !isFav;
          if (base.refType === 'food') {
            if (!base.refId) base.refId = await upsertFood(base.food);
            await db.foods.update(base.refId, { favorite: isFav ? 1 : 0 });
            base.food = await db.foods.get(base.refId);
          } else {
            await db.recipes.update(base.refId, { favorite: isFav ? 1 : 0 });
          }
          fav.classList.toggle('fav', isFav);
          fav.innerHTML = isFav ? icons.starFilled : icons.star;
          fav.setAttribute('aria-pressed', String(isFav));
          fav.setAttribute('aria-label', isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen');
          toast(isFav ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt', { duration: 2000 });
        };
      }

      const ef = $('[data-editfood]', body);
      if (ef) {
        ef.onclick = () => sheet.push(customFoodView(ctx, base.food, {
          onSaved(food) {
            Object.assign(base, baseFromFood(food));
            sheet.back();
          }
        }));
      }

      saveBtn.onclick = async () => {
        const c = update();
        if (!c) return;
        saveBtn.disabled = true;
        await saveEntry(ctx, base, c, existing);
        toast(existing ? 'Eintrag gespeichert' : `${base.name} zu ${mealLabel(ctx.meal)} hinzugefügt`, { duration: 2500 });
        sheet.close();
      };

      const del = $('[data-delete]', body);
      if (del) {
        del.onclick = async () => {
          await db.entries.delete(existing.id);
          ctx.onChange?.();
          sheet.close();
          toast(`„${existing.name}“ gelöscht`, {
            action: 'Rückgängig',
            onAction: async () => {
              await db.entries.put(existing);
              ctx.onChange?.();
            }
          });
        };
      }
    }
  };
}

// ---------- Schnelleintrag ----------

function quickView(ctx, existing = null) {
  const isEdit = !!existing?.id;
  return {
    title: isEdit ? 'Schnelleintrag bearbeiten' : 'Schnelleintrag',
    render(body, sheet) {
      body.innerHTML = `
        <p class="small muted" style="margin-bottom:14px">Für alles, was du nicht genau abwiegen kannst: einfach einen Namen und die Kalorien eintragen.</p>
        <form data-form novalidate>
          <label class="field"><span>Name</span><input class="input" name="name" required placeholder="z. B. Stück Kuchen" value="${esc(existing?.name ?? '')}"></label>
          <label class="field"><span>Kalorien</span><div class="input-suffix"><input class="input" name="kcal" inputmode="decimal" required placeholder="0" value="${inputNum(existing?.kcal, 0)}"><em>kcal</em></div></label>
          <p class="field-label">Optional: Makronährstoffe</p>
          <div class="grid-2" style="grid-template-columns:repeat(3,1fr)">
            <label class="field"><span>Eiweiß</span><div class="input-suffix"><input class="input" name="protein" inputmode="decimal" value="${inputNum(existing?.protein)}"><em>g</em></div></label>
            <label class="field"><span>Kohlenh.</span><div class="input-suffix"><input class="input" name="carbs" inputmode="decimal" value="${inputNum(existing?.carbs)}"><em>g</em></div></label>
            <label class="field"><span>Fett</span><div class="input-suffix"><input class="input" name="fat" inputmode="decimal" value="${inputNum(existing?.fat)}"><em>g</em></div></label>
          </div>
          <label class="field"><span>Mahlzeit</span>
            <select class="input" name="meal">${MEALS.map((m) => `<option value="${m.id}" ${m.id === ctx.meal ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
          </label>
          <p class="small" data-error style="color:var(--danger);margin-bottom:10px" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">${isEdit ? 'Speichern' : 'Hinzufügen'}</button>
          ${isEdit ? `<button type="button" class="btn btn-ghost btn-block" data-delete style="color:var(--danger);margin-top:6px">${icons.trash} Eintrag löschen</button>` : ''}
        </form>`;
      const form = $('[data-form]', body);
      const errEl = $('[data-error]', body);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const name = String(f.get('name')).trim();
        const kcal = parseNum(f.get('kcal'));
        if (!name || kcal == null || kcal < 0) {
          errEl.textContent = 'Bitte gib einen Namen und die Kalorien ein.';
          errEl.hidden = false;
          return;
        }
        ctx.meal = String(f.get('meal'));
        const entry = {
          date: ctx.date,
          meal: ctx.meal,
          name,
          brand: '',
          refType: 'quick',
          refId: null,
          amount: null,
          unit: null,
          grams: null,
          kcal,
          protein: parseNum(f.get('protein')) || 0,
          carbs: parseNum(f.get('carbs')) || 0,
          fat: parseNum(f.get('fat')) || 0,
          createdAt: existing?.createdAt && isEdit ? existing.createdAt : Date.now()
        };
        if (isEdit) await db.entries.put({ ...entry, id: existing.id });
        else await db.entries.add(entry);
        ctx.onChange?.();
        toast(isEdit ? 'Eintrag gespeichert' : `${name} zu ${mealLabel(ctx.meal)} hinzugefügt`, { duration: 2500 });
        sheet.close();
      };
      const del = $('[data-delete]', body);
      if (del) {
        del.onclick = async () => {
          await db.entries.delete(existing.id);
          ctx.onChange?.();
          sheet.close();
          toast(`„${existing.name}“ gelöscht`, {
            action: 'Rückgängig',
            onAction: async () => {
              await db.entries.put(existing);
              ctx.onChange?.();
            }
          });
        };
      }
      if (!isEdit) setTimeout(() => $('input[name="name"]', body)?.focus(), 300);
    }
  };
}

// ---------- Eigenes Lebensmittel anlegen/bearbeiten ----------

/**
 * prefill: vorhandene Werte (z. B. Barcode, unvollständige OFF-Daten)
 * opts.notice: Hinweistext oben, opts.onSaved(food): statt Standardverhalten
 */
export function customFoodView(ctx, prefill = {}, opts = {}) {
  const isEdit = !!prefill.id && prefill.source === 'custom';
  return {
    title: isEdit ? 'Lebensmittel bearbeiten' : 'Eigenes Lebensmittel',
    render(body, sheet) {
      const v = (k, d = 1) => inputNum(prefill[k], d);
      body.innerHTML = `
        ${opts.notice ? `<div class="banner info">${icons.info}<p>${opts.notice}</p></div>` : ''}
        <form data-form novalidate>
          <label class="field"><span>Name *</span><input class="input" name="name" required placeholder="z. B. Vollkornbrot" value="${esc(prefill.name ?? '')}"></label>
          <div class="grid-2">
            <label class="field"><span>Marke</span><input class="input" name="brand" placeholder="optional" value="${esc(prefill.brand ?? '')}"></label>
            <label class="field"><span>Barcode</span><input class="input" name="barcode" inputmode="numeric" placeholder="optional" value="${esc(prefill.barcode ?? '')}"></label>
          </div>
          <p class="section-label" style="margin-top:4px">Nährwerte pro 100 g (siehe Packung)</p>
          <div class="grid-2">
            <label class="field"><span>Kalorien *</span><div class="input-suffix"><input class="input" name="kcal" inputmode="decimal" required value="${v('kcal', 0)}"><em>kcal</em></div></label>
            <label class="field"><span>Eiweiß *</span><div class="input-suffix"><input class="input" name="protein" inputmode="decimal" required value="${v('protein')}"><em>g</em></div></label>
            <label class="field"><span>Kohlenhydrate *</span><div class="input-suffix"><input class="input" name="carbs" inputmode="decimal" required value="${v('carbs')}"><em>g</em></div></label>
            <label class="field"><span>Fett *</span><div class="input-suffix"><input class="input" name="fat" inputmode="decimal" required value="${v('fat')}"><em>g</em></div></label>
          </div>
          <p class="small muted" style="margin:-4px 0 12px">Steht auf der Packung nur kJ? Teile den kJ-Wert durch 4,184.</p>
          <label class="field"><span>Portionsgröße (optional)</span><div class="input-suffix"><input class="input" name="servingGrams" inputmode="decimal" placeholder="z. B. 30" value="${v('servingGrams')}"><em>g</em></div></label>
          <p class="small" data-error style="color:var(--danger);margin-bottom:10px" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">${isEdit ? 'Speichern' : ctx.mode === 'pick' ? 'Speichern und auswählen' : 'Speichern und weiter'}</button>
          ${isEdit ? `<button type="button" class="btn btn-ghost btn-block" data-delete style="color:var(--danger);margin-top:6px">${icons.trash} Lebensmittel löschen</button>` : ''}
        </form>`;

      const form = $('[data-form]', body);
      const errEl = $('[data-error]', body);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const food = {
          name: String(f.get('name')).trim(),
          brand: String(f.get('brand')).trim(),
          barcode: String(f.get('barcode')).replace(/\D/g, ''),
          kcal: parseNum(f.get('kcal')),
          protein: parseNum(f.get('protein')),
          carbs: parseNum(f.get('carbs')),
          fat: parseNum(f.get('fat')),
          servingGrams: parseNum(f.get('servingGrams')) || null,
          servingLabel: '',
          source: 'custom'
        };
        const missing = !food.name || [food.kcal, food.protein, food.carbs, food.fat].some((x) => x == null || x < 0);
        if (missing) {
          errEl.textContent = 'Bitte fülle alle Felder mit * aus (0 ist erlaubt).';
          errEl.hidden = false;
          return;
        }
        if (food.protein + food.carbs + food.fat > 100) {
          errEl.textContent = 'Eiweiß, Kohlenhydrate und Fett zusammen können nicht mehr als 100 g pro 100 g sein. Bitte prüfe die Werte.';
          errEl.hidden = false;
          return;
        }
        let id;
        if (isEdit) {
          id = prefill.id;
          await db.foods.put({ ...prefill, ...food, id });
        } else {
          // Gleicher Barcode schon vorhanden (z. B. aus Open Food Facts)? Dann überschreiben.
          const existing = food.barcode ? await db.foods.where('barcode').equals(food.barcode).first() : null;
          if (existing) {
            id = existing.id;
            await db.foods.put({ ...existing, ...food, id });
          } else {
            id = await db.foods.add({ ...food, favorite: 0, lastUsed: 0 });
          }
        }
        const saved = await db.foods.get(id);
        toast('Lebensmittel gespeichert', { duration: 2000 });
        if (opts.onSaved) return opts.onSaved(saved);
        if (ctx.mode === 'pick') return ctx.onPick(saved);
        sheet.replace(detailView(ctx, baseFromFood(saved)));
      };

      const del = $('[data-delete]', body);
      if (del) {
        del.onclick = async () => {
          const ok = await confirmDialog({
            title: 'Lebensmittel löschen?',
            text: `„${prefill.name}“ wird aus deinen eigenen Lebensmitteln entfernt. Bereits eingetragene Mahlzeiten bleiben erhalten.`,
            ok: 'Löschen',
            danger: true
          });
          if (!ok) return;
          await db.foods.delete(prefill.id);
          toast('Lebensmittel gelöscht', { duration: 2000 });
          // zurück zur Liste (Detailansicht des gelöschten Lebensmittels überspringen)
          sheet.back();
          if (sheet.depth > 1) sheet.back();
        };
      }
    }
  };
}

