// UI-Bausteine: Bottom-Sheet, Toast, Bestätigungsdialog
import { icons } from './icons.js';

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/** HTML-String in ein Element umwandeln */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Toast ----------
let toastTimer = null;
export function toast(message, { action, onAction, duration = 5000 } = {}) {
  let box = $('#toast');
  if (!box) {
    box = el('<div id="toast" class="toast" role="status" aria-live="polite"></div>');
    document.body.append(box);
  }
  box.innerHTML = `<span class="toast-text"></span>${action ? '<button type="button" class="toast-action"></button>' : ''}`;
  $('.toast-text', box).textContent = message;
  const hide = () => {
    box.classList.remove('show');
    clearTimeout(toastTimer);
  };
  if (action) {
    const btn = $('.toast-action', box);
    btn.textContent = action;
    btn.onclick = () => {
      hide();
      onAction?.();
    };
  }
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, duration);
}

// ---------- Bestätigungsdialog ----------
export function confirmDialog({ title, text, ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    const dlg = el(`
      <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal">
          <h2 class="modal-title"></h2>
          <p class="modal-text"></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-r="0"></button>
            <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1"></button>
          </div>
        </div>
      </div>`);
    $('.modal-title', dlg).textContent = title;
    $('.modal-text', dlg).textContent = text;
    $('[data-r="0"]', dlg).textContent = cancel;
    $('[data-r="1"]', dlg).textContent = ok;
    const done = (v) => {
      dlg.remove();
      resolve(v);
    };
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) return done(false);
      const r = e.target.closest('[data-r]');
      if (r) done(r.dataset.r === '1');
    });
    document.body.append(dlg);
    $('[data-r="1"]', dlg).focus();
  });
}

// ---------- Bottom-Sheet mit Ansichts-Stapel ----------
let current = null;

/**
 * Öffnet ein Fenster von unten.
 * view = { title, render(body, sheet), onLeave? }
 */
export function openSheet(view, { onClose } = {}) {
  // Ist schon ein Fenster offen, wird es ersetzt (der Verlaufseintrag bleibt bestehen)
  let reuseHistory = false;
  if (current) {
    reuseHistory = !!history.state?.sheet;
    current._teardown();
  }
  const root = el(`
    <div class="sheet-backdrop">
      <section class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-grip" aria-hidden="true"></div>
        <header class="sheet-head">
          <button type="button" class="icon-btn sheet-back" aria-label="Zurück">${icons.back}</button>
          <h2 class="sheet-title"></h2>
          <button type="button" class="icon-btn sheet-close" aria-label="Schließen">${icons.close}</button>
        </header>
        <div class="sheet-body"></div>
      </section>
    </div>`);
  const stack = [];
  const body = $('.sheet-body', root);
  let closed = false;

  function teardown() {
    closed = true;
    stack.forEach((v) => v.onLeave?.());
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('popstate', onPop);
    root.classList.remove('open');
    setTimeout(() => root.remove(), 250);
    document.body.classList.remove('no-scroll');
    if (current === sheet) current = null;
    onClose?.();
  }

  const sheet = {
    root,
    body,
    push(v) {
      stack.push(v);
      show();
    },
    replace(v) {
      stack.pop()?.onLeave?.();
      stack.push(v);
      show();
    },
    back() {
      if (stack.length <= 1) return sheet.close();
      stack.pop()?.onLeave?.();
      show();
    },
    refresh() { show(); },
    setTitle(t) { $('.sheet-title', root).textContent = t; },
    get depth() { return stack.length; },
    _teardown() { if (!closed) teardown(); },
    close() {
      if (closed) return;
      teardown();
      if (history.state?.sheet) history.back();
    }
  };

  function show() {
    const v = stack[stack.length - 1];
    sheet.setTitle(v.title || '');
    $('.sheet-back', root).hidden = stack.length <= 1;
    body.innerHTML = '';
    body.scrollTop = 0;
    v.render(body, sheet);
  }
  function onKey(e) {
    if (e.key === 'Escape') sheet.back();
  }
  function onPop() {
    // Zurück-Taste (Android) bzw. Wischgeste schließt das Fenster
    if (!closed) teardown();
  }

  root.addEventListener('click', (e) => {
    if (e.target === root) sheet.close();
  });
  $('.sheet-close', root).onclick = () => sheet.close();
  $('.sheet-back', root).onclick = () => sheet.back();
  document.addEventListener('keydown', onKey);

  document.body.append(root);
  document.body.classList.add('no-scroll');
  if (!reuseHistory) history.pushState({ sheet: true }, '');
  window.addEventListener('popstate', onPop);
  requestAnimationFrame(() => root.classList.add('open'));
  current = sheet;
  sheet.push(view);
  return sheet;
}

/** Leerer Zustand mit freundlichem Text */
export function emptyState(icon, title, text) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><p class="empty-title">${title}</p><p class="empty-text">${text}</p></div>`;
}
