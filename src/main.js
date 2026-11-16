// Start der App: Navigation (Hash-Router) und Seitenaufbau
import './style.css';
import { icons } from './icons.js';
import { db, getSetting, setSetting, requestPersist } from './db.js';
import { today } from './format.js';
import { renderDiary } from './pages/diary.js';
import { renderStats } from './pages/stats.js';
import { renderWeight } from './pages/weight.js';
import { renderGoals } from './pages/goals.js';
import { renderSettings } from './pages/settings.js';

const ROUTES = [
  { path: '', label: 'Tagebuch', icon: icons.diary, render: renderDiary },
  { path: 'statistik', label: 'Statistik', icon: icons.stats, render: renderStats },
  { path: 'gewicht', label: 'Gewicht', icon: icons.weight, render: renderWeight },
  { path: 'ziele', label: 'Ziele', icon: icons.goals, render: renderGoals },
  { path: 'einstellungen', label: 'Mehr', icon: icons.settings, render: renderSettings }
];

const app = document.getElementById('app');
const nav = document.getElementById('nav');

nav.innerHTML = `<div class="bottom-nav-inner">${ROUTES.map(
  (r) => `<a href="#/${r.path}" data-path="${r.path}">${r.icon}<span>${r.label}</span></a>`
).join('')}</div>`;

function currentPath() {
  return location.hash.replace(/^#\/?/, '').split('?')[0];
}

let renderToken = 0;
export async function route() {
  const path = currentPath();
  const r = ROUTES.find((x) => x.path === path) ?? ROUTES[0];
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.path === r.path));
  const token = ++renderToken;
  const container = document.createElement('div');
  await r.render(container);
  if (token !== renderToken) return; // inzwischen weiternavigiert
  app.replaceChildren(container);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

async function init() {
  if (!(await getSetting('firstUse'))) await setSetting('firstUse', today());
  requestPersist();
  await route();
}

init().catch((err) => {
  console.error(err);
  app.innerHTML = `<div class="error-box"><p><b>Die App konnte nicht starten.</b><br>
    Möglicherweise blockiert der Browser die Datenspeicherung (z. B. im privaten Modus).<br><small>${String(err.message || err)}</small></p></div>`;
});

// Für Tests/Fehlersuche erreichbar
window.__db = db;
