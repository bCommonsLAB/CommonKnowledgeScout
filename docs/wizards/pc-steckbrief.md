# Wizard: Geräte-Steckbrief erfassen

- **docType:** `refurbedDevice` · **Renderer:** `refurbedDevice`
- **Vorlage (Prüfstand):** [`test-library/templates/pc-steckbrief.md`](../../test-library/templates/pc-steckbrief.md)
- **Status:** 🟢 Entwurf · enthält den bekannten **Renderer-Drift-Fall**

## Ziel

Die Eckdaten eines **refurbished Geräts** (Laptop/PC, das verschenkt wird)
werden als übersichtlicher **Steckbrief** erfasst. Für Menschen, die gespendete
Hardware laienverständlich beschreiben wollen.

## User-Story

- Als **Helfer:in** möchte ich die Hardware-Eckdaten eintragen, **damit**
  Empfänger:innen auf einen Blick sehen, ob das Gerät passt.

## Wann benutzen — und wann nicht

- **Benutze ihn** für ein einzelnes refurbished Gerät.
- **Nicht** für Texte/Events/Dokumente (anderer Inhaltstyp).

## Die Schritte

### 1 — Willkommen
- **Mensch:** liest kurz. · **System:** zeigt Erklärung. · **Warum:** Orientierung.

### 2 — Daten eingeben
- **Mensch:** tippt die Eckdaten (eine einzige Quelle: Freitext).
- **System:** übernimmt die Eingabe.
- **Warum:** Hardware-Daten liegen meist nur im Kopf/auf einem Zettel vor.

### 3 — Steckbrief prüfen
- **Mensch:** prüft/korrigiert **Titel, Geräteart, Prozessor, RAM, Speicher,
  Zustand, Dateiname**. · **System:** normalisiert die Angaben, **erfindet
  nichts**; fehlende Werte bleiben leer.
- **Warum:** der Mensch bestätigt die Technik-Daten.
- **Falle:** zu viele Fachbegriffe → wenige, laienverständliche Felder.

### 4 — Vorschau
- **Mensch:** sieht den fertigen Steckbrief.
- **System:** **soll** als `refurbedDevice` rendern.
- ⚠️ **Heute-Drift:** Der Wizard-Preview kennt nur 4 von 8 Renderer-Typen und
  zeigt `refurbedDevice` ersatzweise als `session`. Behebung in Phase 3a über die
  gemeinsame Renderer-Registry (ADR-0003).

### 5 — Speichern
- **Mensch:** klickt „Speichern". · **System:** legt den Steckbrief ab (bewusst
  **ohne** sofortige Suchindex-Aufnahme).
- **Warum:** Steckbriefe sind Stammdaten, kein Such-Story-Material.

## Bewusst NICHT (damit es niemanden überfordert)

- **Keine** vollständige Hardware-Spezifikation — nur die wenigen relevanten
  Felder.
- **Keine** erfundenen Werte (fehlt = leer).
- **Keine** technischen System-Felder im Formular.

## Erfolgskriterien

> `auto` = heute im Code testbar · `UI` = nur durch Durchklicken.

- [ ] `auto` Einzige Quelle ist **Text**.
- [ ] `auto` „Steckbrief prüfen" zeigt genau `title, device_type, cpu, ram_gb,
  storage_gb, condition_grade, filename`.
- [ ] `auto` Flow enthält einen **Vorschau**-Schritt (`previewDetail`).
- [ ] `auto` **Drift dokumentiert:** Renderer im Schema ist `refurbedDevice`,
  der Wizard-Preview liefert heute `session`.
- [ ] `UI` Speichern nimmt **nicht** automatisch in den Suchindex auf.

## Offene Fragen

- Sollen Geräte-Bilder (Galerie) Teil des Steckbriefs sein?
- Zustandsnote (A/B/C) als Auswahl statt Freitext?
