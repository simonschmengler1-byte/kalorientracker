# Anleitung: Dein Kalorientracker

**Link zur App:** https://simonschmengler1-byte.github.io/kalorientracker/

**Projekt auf GitHub:** https://github.com/simonschmengler1-byte/kalorientracker

Die App läuft im Browser, lässt sich aber wie eine richtige App auf den Startbildschirm legen. Danach öffnet sie sich ohne Adressleiste und funktioniert auch ohne Internet. Nur das Abfragen von Barcodes und die Online-Suche brauchen eine Verbindung.

---

## 1. App auf den Startbildschirm legen

### iPhone (Safari)
1. Öffne den Link oben **in Safari**. In anderen Browsern auf dem iPhone geht es nicht immer.
2. Tippe unten auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben).
3. Scrolle in der Liste nach unten und tippe auf **„Zum Home-Bildschirm“**.
4. Tippe oben rechts auf **„Hinzufügen“**.
5. Ab jetzt öffnest du die App über das grüne Symbol „Kalorien“ auf dem Startbildschirm.

Beim ersten Scannen fragt das iPhone, ob die App die Kamera benutzen darf: Tippe auf **„Erlauben“**.
Falls du das aus Versehen abgelehnt hast, geh in **Einstellungen → Apps → Safari → Kamera** und wähle „Fragen“ oder „Erlauben“.

### Android (Chrome)
1. Öffne den Link oben **in Chrome**.
2. Tippe oben rechts auf die **drei Punkte ⋮**.
3. Tippe auf **„App installieren“** oder **„Zum Startbildschirm hinzufügen“**.
4. Bestätige mit **„Installieren“**.

Beim ersten Scannen fragt Chrome nach der Kamera: Tippe auf **„Bei Nutzung der App zulassen“**.

---

## 2. So benutzt du die App (Kurzfassung)

- **Tagebuch:** Mit den Pfeilen wechselst du den Tag. Tippst du auf das Datum, springst du zurück zu „Heute“.
- **„+“ bei einer Mahlzeit:** Hier suchst du Lebensmittel, scannst einen Barcode (Strichcode-Symbol neben der Suche), machst einen Schnelleintrag oder legst eigene Lebensmittel und Gerichte an.
- **Eintrag antippen:** Menge ändern. **Nach links wischen** oder auf **X** tippen: löschen. Danach erscheint kurz „Rückgängig“.
- **Wasser:** Tippe auf ein Glas, wenn du 250 ml getrunken hast.
- **Ziele:** Gib einmal Alter, Größe, Gewicht und Aktivität ein und tippe auf „Als Ziel übernehmen“.
- **Stern ☆** in der Detailansicht: Damit landet ein Lebensmittel unter „Favoriten“.

---

## 3. Datensicherung – bitte regelmäßig machen!

Deine Daten liegen **nur auf deinem Handy**, in diesem einen Browser. Sie werden nicht ins Internet geladen. Das ist gut für den Datenschutz, heißt aber auch: Wenn du das Handy verlierst, die App löschst oder die Browserdaten löschst, sind deine Daten weg.

**Sicherung machen:**
1. Tippe unten auf **„Mehr“**.
2. Tippe auf **„Sicherung herunterladen“**.
   - **iPhone:** Die Datei landet in der App **„Dateien“** im Ordner **„Downloads“**. Alternativ tippst du auf **„Sicherung teilen / in Dateien sichern“** und wählst z. B. „In Dateien sichern“ → iCloud Drive. Du kannst sie dir auch per Mail schicken.
   - **Android:** Die Datei landet im Ordner **„Downloads“**. Lade sie z. B. in Google Drive hoch oder schick sie dir per Mail.
3. Die Datei heißt z. B. `kalorientracker-sicherung-2026-11-16.json`.

Die App erinnert dich auf der Startseite, wenn deine letzte Sicherung länger als 14 Tage her ist.

**Sicherung wiederherstellen** (z. B. auf einem neuen Handy):
1. App öffnen → **„Mehr“** → **„Sicherung wiederherstellen“**.
2. Die Sicherungsdatei auswählen.
3. Die Warnung lesen und mit **„Ersetzen“** bestätigen. **Achtung:** Alles, was gerade in der App gespeichert ist, wird dabei durch die Sicherung ersetzt.

---

## 4. Änderungen einbauen lassen und neu online stellen

Du musst nichts selbst programmieren. So geht's:

1. Öffne die **Claude-App** und wähle den Ordner **`Projekte/Kalorientracker`** als Arbeitsordner aus.
2. Beschreibe deinen Wunsch in normalen Worten, zum Beispiel:
   > „Bitte füge im Tagebuch eine Notiz pro Tag hinzu. Teste es und stell es danach online.“
3. Claude baut die Änderung ein, testet sie und lädt sie hoch (`git push`). Ab dann geht alles automatisch:
   GitHub baut die App neu und stellt sie nach **etwa 1–2 Minuten** online.
4. Auf dem Handy: App **ganz schließen und wieder öffnen**. Manchmal braucht es zweimal, bis die neue Version da ist, weil die App für den Offline-Betrieb zwischengespeichert ist.

**Deine Daten bleiben bei Updates erhalten**, weil sie nur auf deinem Handy liegen und nicht im Programmcode.

Falls Claude nach einer GitHub-Anmeldung fragt: Folge einfach den Schritten, die Claude dir anzeigt (Link öffnen, Code eingeben, „Authorize“ klicken).

### Wo sehe ich, ob das Online-Stellen geklappt hat?
Auf GitHub in deinem Projekt unter dem Reiter **„Actions“**: Ein grüner Haken ✓ heißt „erfolgreich online“, ein rotes X heißt „hat nicht geklappt“. Dann sag Claude einfach: „Das Online-Stellen ist fehlgeschlagen, bitte prüfen und beheben.“

---

## 5. Gut zu wissen

- **Nährwerte von Open Food Facts** werden von Freiwilligen eingetragen und können Fehler enthalten. Im Zweifel gilt die Packung. Falsche Werte kannst du korrigieren, indem du das Produkt als eigenes Lebensmittel mit demselben Barcode anlegst. Danach nimmt die App immer deine Werte.
- **Suche zeigt „überlastet“?** Open Food Facts ist kostenlos und erlaubt nur wenige Suchen pro Minute. Warte kurz und versuche es noch einmal. Der Barcode-Scan ist davon kaum betroffen.
- **Privater Modus** im Browser: Dort speichert die App nichts dauerhaft. Bitte normal öffnen bzw. vom Startbildschirm starten.
- **Mehrere Geräte:** Die Daten werden nicht automatisch zwischen Handy und Computer abgeglichen. Mit einer Sicherung kannst du sie aber von einem Gerät aufs andere übertragen (das Zielgerät wird dabei überschrieben).
