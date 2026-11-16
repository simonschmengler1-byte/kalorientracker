# Plan: Kalorientracker (PWA)

## Technik
- **Vite** (Build-Werkzeug) + **reines JavaScript** (ES-Module, kein Framework)
- **Dexie** als einfache Schicht über IndexedDB (alle Daten bleiben im Browser)
- **html5-qrcode** für den Barcode-Scanner (läuft auf iPhone-Safari und Android-Chrome)
- **vite-plugin-pwa** erzeugt Manifest + Service Worker (Offline-Fähigkeit, „Zum Startbildschirm“)
- Navigation per Hash-Router (`#/`, `#/ziele`, …) – funktioniert ohne Server-Konfiguration auf GitHub Pages
- Online-Stellung: GitHub Pages, automatisch per GitHub Action bei jedem `git push`
- Tests: Playwright (Handy 390×844 und Desktop)

## Ordnerstruktur
```
index.html              Einstiegsseite
vite.config.js          Build- und PWA-Konfiguration
public/                 App-Icons
src/
  main.js               Start, Router, untere Navigationsleiste
  db.js                 Datenbank-Schema (Dexie) + Hilfsfunktionen
  format.js             Zahlen/Datum im deutschen Format
  calc.js               Nährwert-Umrechnung, Mifflin-St-Jeor, Makros
  off.js                Open-Food-Facts-Abfragen (Barcode, Suche)
  ui.js                 Bausteine: Bottom-Sheet, Toast, Bestätigungsdialog
  backup.js             Sicherung exportieren/importieren
  icons.js              kleine SVG-Icons
  pages/                diary, goals, weight, stats, settings
  sheets/               addFood (Suche, Tabs, Detail, Schnelleintrag, eigenes
                        Lebensmittel), recipe (eigene Gerichte), scanner
  style.css             Design (hell/dunkel, Grün als Akzent)
tests/                  Playwright-Tests
.github/workflows/      Automatisches Veröffentlichen
```

## Datenmodell (IndexedDB über Dexie)
| Tabelle   | Inhalt |
|-----------|--------|
| `foods`   | Lebensmittel: `name, brand, barcode, kcal/protein/carbs/fat pro 100 g, servingGrams, servingLabel, source ('off' / 'custom'), favorite, lastUsed` |
| `recipes` | Eigene Gerichte: `name, items[{name, grams, kcal…pro 100 g}], totalGrams, portions, favorite, lastUsed` – Nährwerte pro 100 g werden berechnet |
| `entries` | Tagebuch-Einträge: `date (JJJJ-MM-TT), meal (breakfast/lunch/dinner/snack), name, brand, amount, unit ('g' / 'portion'), grams, per100 {…}, kcal, protein, carbs, fat, refType ('food'/'recipe'/'quick'), refId` – Nährwerte werden beim Eintragen fest gespeichert |
| `water`   | `date → glasses` (1 Glas = 250 ml) |
| `weights` | `date, kg` |
| `settings`| Schlüssel/Wert: `goals`, `profile`, `lastBackup`, `firstUse`, `theme` |

## Seiten
1. **Tagebuch** (Start): Datumsleiste, kcal-Ring, Makro-Balken, 4 Mahlzeiten, Wasser, Sicherungs-Erinnerung
2. **Essen hinzufügen** (Bottom-Sheet): Suche, Scanner, Tabs Zuletzt / Favoriten / Eigene Lebensmittel / Eigene Gerichte, Schnelleintrag, Detailansicht mit Mengeneingabe
3. **Statistik**: 7-Tage-Balken mit Ziellinie, Durchschnitt kcal & Eiweiß
4. **Gewicht**: Eintragen, Liniendiagramm (eigenes SVG), Start/Aktuell/Veränderung, Zielgewicht
5. **Ziele**: Mifflin-St-Jeor-Rechner, Makros, manuelles Überschreiben, Erklärung
6. **Einstellungen**: Design (System/Hell/Dunkel), Sicherung herunterladen/wiederherstellen, Hinweis zur lokalen Speicherung
