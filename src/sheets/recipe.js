// Eigene Gerichte: mehrere Lebensmittel zu einem Gericht zusammenfassen
import { db } from '../db.js';
import { icons } from '../icons.js';
import { num, inputNum, parseNum, esc } from '../format.js';
import { scale, sumNutrients } from '../calc.js';
import { $, $$, toast, confirmDialog, emptyState } from '../ui.js';

/**
 * recipe: vorhandenes Gericht oder null (neu)
 * pickerView(onPick) wird übergeben, um Zutaten auszuwählen
 */
export function recipeEditorView(ctx, recipe, { pickerView }) {
  const draft = recipe
    ? structuredClone({ ...recipe, totalGramsInput: recipe.totalGramsManual ? recipe.totalGrams : null })
    : { name: '', items: [], portions: 1, totalGramsInput: null };

  return {
    title: recipe ? 'Gericht bearbeiten' : 'Neues Gericht',
    render(body, sheet) {
      const myDepth = sheet.depth;
      const sumGrams = () => draft.items.reduce((s, i) => s + (i.grams || 0), 0);
      const totals = () => sumNutrients(draft.items.map((i) => scale(i.per100, i.grams || 0)));

      body.innerHTML = `
        <label class="field"><span>Name des Gerichts</span>
          <input class="input" data-name placeholder="z. B. Chili con Carne" value="${esc(draft.name)}">
        </label>
        <p class="section-label">Zutaten</p>
        <div data-items></div>
        <button type="button" class="btn btn-outline btn-block" data-add style="margin-bottom:18px">${icons.plus} Zutat hinzufügen</button>
        <div class="grid-2">
          <label class="field"><span>Gesamtgewicht (fertig)</span>
            <div class="input-suffix"><input class="input" data-total inputmode="decimal" value="${inputNum(draft.totalGramsInput, 0)}"><em>g</em></div>
          </label>
          <label class="field"><span>Anzahl Portionen</span>
            <input class="input" data-portions inputmode="decimal" value="${inputNum(draft.portions, 1)}">
          </label>
        </div>
        <p class="small muted" style="margin:-6px 0 14px">Gesamtgewicht leer lassen = Summe der Zutaten. Wiege den fertigen Topf, wenn beim Kochen Wasser verdampft oder dazukommt.</p>
        <section class="card" data-summary></section>
        <p class="small" data-error style="color:var(--danger);margin-bottom:10px" hidden></p>
        <button type="button" class="btn btn-primary btn-block" data-save>Gericht speichern</button>
        ${recipe ? `<button type="button" class="btn btn-ghost btn-block" data-delete style="color:var(--danger);margin-top:6px">${icons.trash} Gericht löschen</button>` : ''}`;

      const itemsBox = $('[data-items]', body);
      const totalIn = $('[data-total]', body);
      const portionsIn = $('[data-portions]', body);
      const summary = $('[data-summary]', body);
      const errEl = $('[data-error]', body);

      $('[data-name]', body).addEventListener('input', (e) => { draft.name = e.target.value; });
      totalIn.addEventListener('input', () => { draft.totalGramsInput = parseNum(totalIn.value); drawSummary(); });
      portionsIn.addEventListener('input', () => { draft.portions = parseNum(portionsIn.value); drawSummary(); });

      function drawItems() {
        totalIn.placeholder = num(sumGrams());
        if (draft.items.length === 0) {
          itemsBox.innerHTML = `<div class="list">${emptyState(icons.pot, 'Noch keine Zutaten', 'Füge die Lebensmittel hinzu, aus denen dein Gericht besteht, und gib jeweils die Menge an.')}</div>`;
          return;
        }
        itemsBox.innerHTML = `<div class="list">${draft.items.map((it, i) => `
          <div class="ingredient" data-i="${i}">
            <div class="grow">
              <div class="list-item-title">${esc(it.name)}</div>
              <div class="list-item-sub tabular" data-kcal>${num(scale(it.per100, it.grams || 0).kcal)} kcal</div>
            </div>
            <div class="input-suffix"><input class="input tabular" inputmode="decimal" value="${inputNum(it.grams, 1)}" aria-label="Menge ${esc(it.name)} in Gramm" style="padding-right:30px"><em style="right:10px">g</em></div>
            <button type="button" class="icon-btn" data-remove aria-label="${esc(it.name)} entfernen">${icons.close}</button>
          </div>`).join('')}</div>`;
        $$('.ingredient', itemsBox).forEach((row) => {
          const i = Number(row.dataset.i);
          const input = $('input', row);
          input.addEventListener('input', () => {
            draft.items[i].grams = parseNum(input.value) || 0;
            $('[data-kcal]', row).textContent = `${num(scale(draft.items[i].per100, draft.items[i].grams).kcal)} kcal`;
            totalIn.placeholder = num(sumGrams());
            drawSummary();
          });
          $('[data-remove]', row).onclick = () => {
            draft.items.splice(i, 1);
            drawItems();
            drawSummary();
          };
        });
      }

      function drawSummary() {
        const t = totals();
        const totalGrams = draft.totalGramsInput || sumGrams();
        const portions = draft.portions > 0 ? draft.portions : 1;
        const per = (v) => v / portions;
        summary.innerHTML = `
          <div class="card-title"><span>Pro Portion</span><span class="card-sub tabular">${num(totalGrams / portions)} g</span></div>
          <div class="nutri-grid">
            <div class="k"><b class="tabular">${num(per(t.kcal))}</b><span>kcal</span></div>
            <div><b class="tabular">${num(per(t.protein), 1)}</b><span>Eiweiß g</span></div>
            <div><b class="tabular">${num(per(t.carbs), 1)}</b><span>Kohlenh. g</span></div>
            <div><b class="tabular">${num(per(t.fat), 1)}</b><span>Fett g</span></div>
          </div>
          <p class="per100">Ganzes Gericht: ${num(t.kcal)} kcal · ${num(totalGrams)} g</p>`;
      }

      $('[data-add]', body).onclick = () => {
        sheet.push(pickerView((food) => {
          draft.items.push({
            foodId: food.id ?? null,
            name: food.name,
            brand: food.brand || '',
            grams: food.servingGrams || 100,
            per100: { kcal: food.kcal || 0, protein: food.protein || 0, carbs: food.carbs || 0, fat: food.fat || 0 }
          });
          // zurück zum Gericht (auch aus Scanner/Formular heraus)
          while (sheet.depth > myDepth) sheet.back();
          toast(`${food.name} hinzugefügt – Menge anpassen`, { duration: 2000 });
        }));
      };

      $('[data-save]', body).onclick = async () => {
        const name = draft.name.trim();
        const sum = sumGrams();
        const portions = draft.portions;
        let error = '';
        if (!name) error = 'Bitte gib dem Gericht einen Namen.';
        else if (draft.items.length === 0) error = 'Bitte füge mindestens eine Zutat hinzu.';
        else if (sum <= 0) error = 'Bitte gib die Mengen der Zutaten an.';
        else if (!portions || portions <= 0) error = 'Bitte gib die Anzahl der Portionen an (mindestens 1).';
        if (error) {
          errEl.textContent = error;
          errEl.hidden = false;
          return;
        }
        const totalGrams = draft.totalGramsInput > 0 ? draft.totalGramsInput : sum;
        const t = totals();
        const f = 100 / totalGrams;
        const data = {
          name,
          items: draft.items,
          portions,
          totalGrams,
          totalGramsManual: draft.totalGramsInput > 0,
          per100: { kcal: t.kcal * f, protein: t.protein * f, carbs: t.carbs * f, fat: t.fat * f },
          favorite: recipe?.favorite ?? 0,
          lastUsed: recipe?.lastUsed ?? 0
        };
        if (recipe) await db.recipes.put({ ...data, id: recipe.id });
        else await db.recipes.add(data);
        toast(`Gericht „${name}“ gespeichert`, { duration: 2500 });
        if (ctx.browser) ctx.browser.tab = 'recipes';
        sheet.back();
      };

      const del = $('[data-delete]', body);
      if (del) {
        del.onclick = async () => {
          const ok = await confirmDialog({
            title: 'Gericht löschen?',
            text: `„${recipe.name}“ wird gelöscht. Bereits eingetragene Mahlzeiten bleiben erhalten.`,
            ok: 'Löschen',
            danger: true
          });
          if (!ok) return;
          await db.recipes.delete(recipe.id);
          toast('Gericht gelöscht', { duration: 2000 });
          sheet.back();
        };
      }

      drawItems();
      drawSummary();
    }
  };
}
