// Barcode-Scanner (Kamera) + Abfrage bei Open Food Facts
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { db } from '../db.js';
import { icons } from '../icons.js';
import { esc } from '../format.js';
import { fetchByBarcode } from '../off.js';
import { $ } from '../ui.js';
import { baseFromFood } from './addFood.js';

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E
];

// Die Scanner-Bibliothek meldet beim schnellen Schließen der Kamera einen harmlosen Fehler
// ("play() request was interrupted"). Diesen fangen wir ab, damit er nicht als Absturz erscheint.
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.name === 'AbortError' && /play\(\)/.test(e.reason?.message || '')) e.preventDefault();
});

export function scannerView(ctx, { detailView, customFoodView }) {
  let scanner = null;
  let starting = null; // läuft der Kamerastart noch?
  let stopped = false;

  async function stopCamera() {
    stopped = true;
    const s = scanner;
    scanner = null;
    if (!s) return;
    // Erst den Start abwarten, sonst bleibt die Kamera evtl. an
    if (starting) await starting.catch(() => {});
    try {
      if (s.isScanning) await s.stop();
      s.clear();
    } catch { /* schon gestoppt */ }
  }

  return {
    title: 'Barcode scannen',
    onLeave() { stopCamera(); },
    render(body, sheet) {
      stopped = false;
      body.innerHTML = `
        <div class="scanner-box">
          <div id="reader"></div>
          <div class="scanner-frame" aria-hidden="true"></div>
          <div class="scanner-line" aria-hidden="true"></div>
          <div class="scanner-msg" data-msg>Kamera wird gestartet …</div>
        </div>
        <p class="small muted" style="text-align:center;margin-bottom:18px">Halte den Strichcode in den Rahmen. Er wird automatisch erkannt.</p>
        <form data-manual class="card">
          <label class="field" style="margin-bottom:10px"><span>Oder Barcode eintippen</span>
            <input class="input tabular" name="code" inputmode="numeric" pattern="[0-9]*" placeholder="z. B. 4008400402222" autocomplete="off">
          </label>
          <button class="btn btn-primary btn-block" type="submit">Suchen</button>
        </form>`;

      const msg = $('[data-msg]', body);
      $('[data-manual]', body).onsubmit = (e) => {
        e.preventDefault();
        const code = String(new FormData(e.target).get('code')).replace(/\D/g, '');
        if (code.length >= 6) handleCode(code);
      };

      startCamera();

      async function startCamera() {
        if (!navigator.mediaDevices?.getUserMedia) {
          msg.innerHTML = 'Die Kamera ist in diesem Browser nicht verfügbar.<br>Bitte gib den Barcode unten ein.';
          return;
        }
        try {
          scanner = new Html5Qrcode('reader', {
            formatsToSupport: FORMATS,
            useBarCodeDetectorIfSupported: true,
            verbose: false
          });
          starting = scanner.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: (w, h) => ({ width: Math.max(50, Math.floor(w * 0.8)), height: Math.max(50, Math.floor(h * 0.4)) }),
              aspectRatio: 4 / 3
            },
            (text) => {
              if (stopped) return;
              const code = text.replace(/\D/g, '');
              if (code.length < 6) return;
              if (navigator.vibrate) navigator.vibrate(60);
              handleCode(code);
            },
            () => { /* kein Code im Bild – weiter suchen */ }
          );
          await starting;
          starting = null;
          if (stopped) return;
          msg.hidden = true;
        } catch (err) {
          const name = err?.name || String(err);
          console.warn('Kamera-Fehler', err);
          if (/NotAllowed|Permission/i.test(name)) {
            msg.innerHTML = 'Kein Zugriff auf die Kamera.<br><small>Erlaube den Kamerazugriff in den Browser-Einstellungen oder tippe den Barcode unten ein.</small>';
          } else if (/NotFound|Overconstrained/i.test(name)) {
            msg.innerHTML = 'Keine Kamera gefunden.<br><small>Bitte gib den Barcode unten ein.</small>';
          } else {
            msg.innerHTML = 'Die Kamera konnte nicht gestartet werden.<br><small>Bitte gib den Barcode unten ein.</small>';
          }
        }
      }

      async function handleCode(code) {
        await stopCamera();
        sheet.replace(lookupView(ctx, code, { detailView, customFoodView }));
      }
    }
  };
}

/** Ergebnis-Ansicht: erst lokal suchen, dann Open Food Facts */
function lookupView(ctx, code, { detailView, customFoodView }) {
  return {
    title: 'Produkt suchen',
    async render(body, sheet) {
      const goDetail = (food) => {
        if (ctx.mode === 'pick') return ctx.onPick(food);
        sheet.replace(detailView(ctx, baseFromFood(food)));
      };
      const goCustom = (prefill, notice) => sheet.replace(customFoodView(ctx, prefill, { notice }));

      // 1. Schon lokal gespeichert? (eigene Werte haben Vorrang)
      const local = await db.foods.where('barcode').equals(code).toArray();
      const own = local.find((f) => f.source === 'custom') ?? local[0];
      if (own) return goDetail(own);

      body.innerHTML = `<div class="loading"><div class="spinner"></div>Suche Barcode ${esc(code)} bei Open Food Facts …</div>`;
      try {
        const food = await fetchByBarcode(code);
        if (!food) {
          return goCustom({ barcode: code },
            `Das Produkt mit dem Barcode <b>${esc(code)}</b> wurde nicht gefunden. Trage die Werte von der Packung ein – beim nächsten Scan wird es sofort erkannt.`);
        }
        if (!food.complete) {
          return goCustom({ ...food, source: 'custom' },
            'Für dieses Produkt fehlen bei Open Food Facts einige Nährwerte. Bitte ergänze sie von der Packung – sie werden für den nächsten Scan gespeichert.');
        }
        goDetail(food);
      } catch (err) {
        body.innerHTML = `
          <div class="error-box">${icons.alert}<div><p><b>Abfrage nicht möglich</b><br>${esc(err.message)}</p></div></div>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" data-retry>Erneut versuchen</button>
            <button type="button" class="btn btn-outline" data-manual>Selbst eintragen</button>
          </div>`;
        $('[data-retry]', body).onclick = () => sheet.refresh();
        $('[data-manual]', body).onclick = () => goCustom({ barcode: code });
      }
    }
  };
}
