// Berechnungen: Nährwerte, Grundumsatz, Makros

export const MEALS = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittagessen' },
  { id: 'dinner', label: 'Abendessen' },
  { id: 'snack', label: 'Snacks' }
];
export const mealLabel = (id) => MEALS.find((m) => m.id === id)?.label ?? id;

/** Vorschlag für Mahlzeit nach Uhrzeit */
export function mealForNow() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

/** Nährwerte für eine Grammzahl aus Werten pro 100 g */
export function scale(per100, grams) {
  const f = grams / 100;
  return {
    kcal: (per100.kcal || 0) * f,
    protein: (per100.protein || 0) * f,
    carbs: (per100.carbs || 0) * f,
    fat: (per100.fat || 0) * f
  };
}

export function sumNutrients(list) {
  return list.reduce(
    (a, e) => ({
      kcal: a.kcal + (e.kcal || 0),
      protein: a.protein + (e.protein || 0),
      carbs: a.carbs + (e.carbs || 0),
      fat: a.fat + (e.fat || 0)
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export const ACTIVITY = [
  { id: 'sedentary', factor: 1.2, label: 'Kaum aktiv', hint: 'Bürojob, wenig Bewegung' },
  { id: 'light', factor: 1.375, label: 'Leicht aktiv', hint: '1–3× Sport pro Woche oder viel zu Fuß' },
  { id: 'moderate', factor: 1.55, label: 'Aktiv', hint: '3–5× Sport pro Woche' },
  { id: 'very', factor: 1.725, label: 'Sehr aktiv', hint: 'Täglich Sport oder körperliche Arbeit' }
];

export const GOAL_TYPES = [
  { id: 'lose', delta: -500, label: 'Abnehmen', hint: '−500 kcal' },
  { id: 'maintain', delta: 0, label: 'Gewicht halten', hint: '±0 kcal' },
  { id: 'gain_slow', delta: 300, label: 'Langsam zunehmen', hint: '+300 kcal' },
  { id: 'gain', delta: 500, label: 'Zunehmen', hint: '+500 kcal' }
];

/** Grundumsatz nach Mifflin-St-Jeor */
export function bmr({ sex, age, height, weight }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

/** Komplette Zielberechnung aus dem Profil */
export function computeGoals(profile) {
  const b = bmr(profile);
  const act = ACTIVITY.find((a) => a.id === profile.activity) ?? ACTIVITY[0];
  const tdee = b * act.factor;
  const goal = GOAL_TYPES.find((g) => g.id === profile.goalType) ?? GOAL_TYPES[1];
  const kcal = Math.round(tdee + goal.delta);
  return { bmr: Math.round(b), tdee: Math.round(tdee), kcal, ...macrosFor(kcal, profile.weight) };
}

/** Eiweiß 1,8 g/kg, Fett 27 % der kcal, Rest Kohlenhydrate */
export function macrosFor(kcal, weight) {
  const protein = Math.round(1.8 * weight);
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { protein, fat, carbs };
}

export const DEFAULT_GOALS = { kcal: 2000, protein: 120, carbs: 230, fat: 60 };
export const WATER_GLASS_ML = 250;
export const WATER_GOAL_ML = 2500;
