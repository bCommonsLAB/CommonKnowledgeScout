# Manuelles E2E-Test-Szenario: Composite Multi-Image (Bild-Sammelanalyse)

> Pflicht-Szenario aus `composite-multi-image_b1a4f720.plan.md` (S8).
> Dieses Dokument beschreibt den End-to-End-Test, der nach Implementierung der
> Schritte S1-S7 manuell vom Anwender durchgespielt werden muss, bevor die
> Funktion als „abgenommen" gilt.

## Kurzfassung

Drei zusammenhaengende Bilder (CORTINA-Bett-Steckbrief, Seiten 9-11) werden
gemeinsam an den Vision-LLM gegeben und liefern EIN konsolidiertes Datenblatt
mit Konfigurationstabellen aus allen drei Bildern.

## Voraussetzungen

| Ding | Pruefung |
| --- | --- |
| Library hat `provider: openrouter` | Multi-Image-Calls funktionieren NUR mit openrouter (Secretary-Spec). |
| Mindestens 2, hoechstens 10 Bilder im selben Verzeichnis | Hartes Limit aus `ImageAnalyzerProcessor.MAX_IMAGES_PER_REQUEST`. |
| Secretary-Service erreichbar | `getSecretaryConfig().baseUrl` muss reagieren. |
| Vision-faehiges LLM-Modell konfiguriert | z.B. `openai/gpt-4o`, `anthropic/claude-sonnet-4`. |

## Vorbereitung der Test-Daten

1. CORTINA-PDF in eine Test-Bibliothek hochladen.
2. „PDF-Seiten als Bilder rendern" laufen lassen, bis `page_009__cortina.jpeg`,
   `page_010__cortina.jpeg`, `page_011__cortina.jpeg` als Geschwister
   neben dem PDF liegen.
3. In der Datei-Liste auf das Verzeichnis dieser Bilder navigieren.

## Schritt-fuer-Schritt-Test

### 1. Toolbar-Aktion sichtbar?

- Drei Bilder per Checkbox selektieren.
- **Erwartet:** Der Toolbar-Button mit dem `Images`-Icon (Tooltip
  „Bild-Sammelanalyse erstellen") erscheint zwischen `FolderSync` und
  „Sammel-Transkript erstellen".
- **Stop-Bedingung:** Wenn der Button bei reiner Bild-Selektion fehlt, S6
  erneut pruefen (`compositeMultiEligible` Memo, `isImageMediaFromName`).

### 2. Erstellungsdialog korrekt vorbelegt?

- Auf den Button klicken.
- **Erwartet:** Modal-Dialog mit:
  - Dateiname-Feld vorbelegt mit `page_zusammenstellung.md` oder aehnlichem
    Default (gemeinsamer Praefix der Quellen + `_zusammenstellung.md`).
  - Optionalem Titel-Feld.
  - Abbrechen + Erstellen-Buttons.
- Den Dateinamen ggf. anpassen (z.B. `cortina_steckbrief.md`).
- Optional einen Titel eingeben (z.B. „Bett CORTINA — Konfigurationsseiten").

### 3. POST `/api/library/.../composite-multi` erfolgreich?

- „Erstellen" klicken.
- **Erwartet:**
  - Toast „Bild-Sammelanalyse erstellt: cortina_steckbrief.md (3 Bilder)".
  - Dialog schliesst.
  - Datei-Liste aktualisiert sich; die neue `.md`-Datei taucht im selben
    Verzeichnis wie die Bilder auf.

#### Negativ-Pfade pruefen

| Aktion | Erwartetes Verhalten |
| --- | --- |
| Datei mit demselben Namen existiert bereits | `409 Conflict`-Toast „Dateiname bereits vergeben". Kein Neuerstellen. |
| Nur 1 Bild selektiert | Button gar nicht sichtbar. |
| 11+ Bilder selektiert | Button gar nicht sichtbar. |
| Bilder + Nicht-Bild gemischt | Button gar nicht sichtbar. |

### 4. Composite-MD korrekt persistiert?

- Die neue `.md`-Datei oeffnen.
- **Erwartet im Frontmatter:**
  ```yaml
  ---
  _source_files: ["page_009__cortina.jpeg","page_010__cortina.jpeg","page_011__cortina.jpeg"]
  kind: composite-multi
  createdAt: <ISO-Timestamp>
  ---
  ```
- **Erwartet im Body:**
  - `# <Titel>` (oder Default „Bild-Sammelanalyse").
  - `## Quellen` mit nummerierter Liste `1. [[page_009__cortina.jpeg]]` ...
  - `## Vorschau` mit Wiki-Embeds.

### 5. Vorschau-Grid sichtbar?

- **Erwartet:** Im Vorschau-Bereich erscheint unter „Vorschau" ein Grid
  (2-3 Spalten, je nach Viewport) mit den drei Bildern.
- **Diagnose-Pfad bei Problemen:**
  - DOM-Inspektor: `<div class="ks-composite-multi-grid grid grid-cols-2 ...">`
    sollte vorhanden sein.
  - Jedes `<img class="ks-composite-multi-image">` muss `data-ks-resolved="1"`
    nach Render haben (siehe `markdown-preview.tsx`-`useEffect`).
  - Wenn `data-ks-resolved` fehlt: `siblingNameToId` ist leer → Sibling-
    Files-API pruefen.

### 6. Analyse starten

- Auf der `.md`-Datei „Analysieren" / „Neu analysieren" klicken
  (Standard-Workflow im Vorschau-Panel).
- **Erwartet:** Job laeuft (Status: `running`).
- Der Worker erkennt `kind: composite-multi` (Logs: `composite-multi-image
  Composite-Multi-Pfad gestartet`) und ruft den Multi-Image-Endpoint des
  Secretary auf (Server-Log: `Multi-Image Secretary-Aufruf imageCount=3`).

### 7. Ergebnis-Markdown pruefen

- Nach Abschluss des Jobs (Status `completed`):
  - **Erwartet:** Ein Shadow-Twin-Artefakt der `.md`-Sammelanalyse-Datei
    mit dem analysierten Steckbrief erscheint im Vorschau-Panel.
  - Inhalt: Konfigurationstabellen aus ALLEN drei Bildern in einem
    konsistenten Markdown-Datenblatt.
  - Frontmatter des Ergebnisses enthaelt `template`-Bezug + `targetLanguage`.

### 8. Cache-Bypass pruefen

- „Neu analysieren" auf derselben `.md`-Datei.
- **Erwartet:** Der Secretary erhaelt `useCache=false` (Default), neuer
  LLM-Call (im Secretary-Log: kein „Cache-Hit fuer Bildanalyse"), neues
  Ergebnis-Artefakt.

## Akzeptanzkriterium

S8 gilt als bestanden, wenn:

1. Schritte 1-7 ohne Fehler durchlaufen.
2. Das finale Steckbrief-Markdown alle drei Bilder semantisch korrekt
   verarbeitet (Pruefung: enthaelt es Daten/Tabellen, die NUR auf Seite 11
   stehen, oder ignoriert es spaetere Bilder?).
3. Negativ-Pfade in Schritt 3 wie erwartet abgewiesen werden.

## Bei Fehlschlag

- Logs in dieser Reihenfolge pruefen:
  1. Browser-Konsole (UI/Toolbar-Pfad).
  2. App-Server-Log: `composite-multi/api`, `run-composite-multi-image`.
  3. Secretary-Service-Log: `image-analyzer/process`-Endpoint.
- Bei „multi-image not supported" → Library-Provider ist nicht `openrouter`.
  Klare Fehlermeldung an den User; kein silent fallback.
- Bei Composite-Multi-Resolution-Fehler → Sibling-Files-Lookup pruefen.
