# Wizard: Event erfassen (Story aus Ordner / Import)

- **docType:** `event` · **Renderer:** `session`
- **Vorlage (Prüfstand):** [`test-library/templates/event.md`](../../test-library/templates/event.md)
- **Status:** 🟢 Format abgenommen · Anforderungen 2026-06-02 eingearbeitet

## Ziel

Aus einer Quelle deiner Wahl — Freitext, einer **Webseite/URL** oder einem
**Ordner** mit Material — entsteht **eine lesbare, einladend bebilderte
Event-Story**. Für Menschen, die ein Treffen/eine Veranstaltung festhalten oder
ankündigen wollen, ohne selbst zu formulieren.

## User-Story

- Als **Organisator:in** möchte ich mein Event aus meinen Notizen erfassen,
  **damit** daraus ohne Schreibarbeit eine teilbare Story wird.
- Als **Organisator:in** möchte ich die **bestehende Event-Webseite importieren**,
  **damit** ich Titel, Datum, Ort usw. nicht abtippen muss.
- Als **Leser:in** möchte ich die Story **mit Titelbild ansprechend** sehen,
  **damit** sie einladend wirkt.

## Relevante Felder

Ein Event hat typische, **wichtige** Angaben. Diese gehören ins Datenmodell:

| Feld | heute im Prüfstand | Ziel-Anforderung |
|---|---|---|
| Titel | ✅ `title` | ✅ |
| Zusammenfassung | ✅ `summary` | ✅ |
| Datum | ✅ `event_date` | ✅ |
| **Uhrzeit** | ❌ | 🎯 ergänzen (`start_time`/`end_time`) |
| Ort | ✅ `location` | ✅ |
| **Webseite/Link** | ❌ | 🎯 ergänzen (`url`) |
| **Veranstalter** | ❌ | 🎯 ergänzen (`organizer`) |
| **Moderation** | ❌ | 🎯 ergänzen (`moderation`) |
| **Titelbild** | ❌ | 🎯 ergänzen (Cover-Bild für einladende Ansicht) |

> 🎯 = gewünscht, aber **heute noch nicht** im Prüfstand/Runtime. Bewusst als
> Lücke markiert (kein Schönreden) — Umsetzung folgt aus diesem Konzept.

## Wann benutzen — und wann nicht

- **Benutze ihn**, um ein **neues** Event aus Rohmaterial oder per Webseiten-
  Import zu erstellen.
- **Nicht** für das **finale** Zusammenführen mit Testimonials → „Event
  finalisieren".
- **Nicht** für ein einzelnes Zitat → „Testimonial erfassen".

## Die Schritte

> Bei Start **aus einem Ordner** erscheinen zusätzlich „Artefakte auswählen" und
> „Entwurf erzeugen". Bei Freitext/URL entfallen diese (Entwurf entsteht direkt).

### 1 — Willkommen
- **Mensch:** liest kurz, worum es geht. · **System:** zeigt Erklärung.
- **Warum:** Orientierung vor dem Start.

### 2 — Quelle wählen
- **Mensch:** wählt **Text**, **Webseite/URL** oder **Ordner** und gibt das
  Material an.
- **System:** übernimmt die Quelle; bei URL wird der Seiteninhalt geladen;
  „Weiter" erst, wenn etwas da ist.
- **Warum:** ohne Quelle keine Story; Import spart Abtippen.
- **Falle:** eine Webseite enthält **viel Beiwerk** (Menü, Footer, Werbung).
  Nur der **Event-Teil** ist relevant → das System muss den Lärm aussortieren
  (wie genau: siehe Offene Fragen).

### 3 — Artefakte auswählen *(nur bei Ordner-Start)*
- **Mensch:** hakt an, was hineinsoll. · **System:** „Weiter" erst bei ≥1 Wahl.
- **Warum:** der Mensch entscheidet, was relevant ist.
- **Falle:** Vorauswahl „alles" → Müll-Stories; daher bewusst leer.

### 4 — Entwurf erzeugen *(nur bei Ordner-Start)*
- **Mensch:** wartet kurz, prüft. · **System:** verdichtet die Quellen zum
  Event-Entwurf, **ohne Fakten zu erfinden**.
- **Warum:** Schreibarbeit abnehmen, Kontrolle behalten.

### 5 — Felder prüfen
- **Mensch:** prüft/korrigiert die wichtigen Event-Felder (siehe oben) und lädt
  ein **Titelbild** hoch.
- **System:** zeigt **nur Inhalts-Felder**, keine System-Felder.
- **Warum:** der Mensch bestätigt die Angaben; das Bild macht die Story
  einladend.
- **Falle:** technische Felder (z.B. `slug`) würden verwirren → ausgeblendet.

### 6 — Vorschau
- **Mensch:** sieht die fertige Story inkl. Bild. · **System:** rendert
  `session`.
- **Warum:** „Was du siehst, ist was du bekommst".

### 7 — Veröffentlichen
- **Mensch:** klickt „Veröffentlichen". · **System:** speichert + nimmt in den
  Suchindex auf; „Fertig" erst nach Erfolg.
- **Warum:** erst ab hier ist die Story wirklich da.

## Bewusst NICHT (damit es niemanden überfordert)

- **Keine** Bearbeitung technischer/System-Felder im Formular.
- **Keine** Pflicht, alle Felder zu füllen — leer lassen ist erlaubt.
- **Kein** ungefiltertes Übernehmen ganzer Webseiten (nur der Event-Teil).
- **Kein** Mischen mit Testimonials hier (→ „Event finalisieren").

## Erfolgskriterien

> `auto` = heute im Code testbar · `auto-🎯` = testbar, sobald Ziel-Feld gebaut ·
> `UI` = nur durch Durchklicken.

- [ ] `auto` Ohne Ordner-Start fehlen „Artefakte auswählen" + „Entwurf erzeugen";
  mit Ordner-Start sind sie da.
- [ ] `auto` „Felder prüfen" zeigt **keine** System-Felder (`slug`, `docType`, …).
- [ ] `auto` „Quelle wählen" lässt „Weiter" erst bei vorhandener Quelle zu.
- [ ] `auto` „Artefakte auswählen" verlangt ≥1 gewähltes Artefakt.
- [ ] `auto` „Veröffentlichen" erlaubt „Fertig" erst nach erfolgreichem Speichern.
- [ ] `auto` Vorschau-Renderer ist `session`.
- [ ] `auto-🎯` Felder enthalten Uhrzeit, Webseite, Veranstalter, Moderation.
- [ ] `UI` Drei Quell-Typen (Text/URL/Ordner) sind sichtbar und benannt.
- [ ] `UI` Webseiten-Import übernimmt Event-Daten ohne Menü/Footer-Lärm.
- [ ] `UI` Titelbild lässt sich hochladen und erscheint in der Vorschau.
- [ ] `UI` Nach „Veröffentlichen" liegt eine `.md`-Datei im Ziel-Ordner.

## Offene Fragen

- **Webseiten-Lärm:** Wie trennen wir den Event-Inhalt vom Drumherum?
  (LLM-Extraktion mit klarer Anweisung? Auswahl durch den Menschen? Noch offen.)
- Uhrzeit als echtes Zeit-Eingabefeld statt Freitext?
- Veranstalter/Moderation: Freitext oder Verknüpfung zu Personen?
- Bei sehr vielen Ordner-Artefakten: Begrenzung/Suche nötig?
