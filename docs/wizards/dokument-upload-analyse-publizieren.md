# Flow: Dokumente hochladen → analysieren → abnehmen → publizieren

- **Art:** Ingestion-/Publikations-Flow (kein Schritt-Assistent, sondern
  Upload + Hintergrund-Analyse + Freigabe)
- **Ergebnis-Renderer:** je nach Ziel-Schema (z.B. `book` für analysierte PDFs)
- **Status:** 🟡 Entwurf — wichtigster aktueller Anwendungsfall (2026-06-02)
- **Verwandt:** [`test-library/templates/pdfanalyse.md`](../../test-library/templates/pdfanalyse.md)
  (Analyse-Schema), [ADR-0004](../adr/0004-capture-publish-entkopplung-inbox-modell.md)
  (Inbox/Freigabe), Story-Publikations-Flow (Transkript → Transformation → Publikation)

## Ziel

Mitwirkende bauen gemeinsam eine **Library** auf, indem sie **Dokumente
hochladen**. Das System **analysiert** sie automatisch; eine berechtigte Person
**nimmt** das Ergebnis **ab** (und korrigiert fehlende/falsche Metadaten); dann
wird es **ins Internet publiziert**.

## User-Story

- Als **Co-Kreateur:in/Owner** möchte ich einfach Dokumente hochladen, **damit**
  die Library wächst, ohne dass ich Metadaten von Hand erfasse.
- Als **Abnehmende:r** möchte ich vor der Veröffentlichung die **wichtigen
  Felder prüfen und korrigieren**, **damit** nur saubere Inhalte online gehen.

## Wer darf was

- **Hochladen + Abnehmen:** Co-Kreateur:innen und Owner.
- (Reine Leser:innen: nein.)

## Was rein darf — und was nicht

- **Akzeptiert:** alle vom System verstehbaren Dokumente — **PDF, Excel,
  Markdown**. Ideal: Dokumente mit **Kapitel-/Inhaltsverzeichnis-Struktur**.
- **Nicht hier:** Audio-/Media-Dateien (laufen über einen eigenen Pfad).

## Die Stufen (= Story-Publikations-Flow)

### 1 — Hochladen
- **Mensch:** lädt ein oder mehrere Dokumente hoch.
- **System:** nimmt sie an, prüft den Typ (PDF/Excel/Markdown).
- **Warum:** niederschwelliger Einstieg, kein Formular.
- **Falle:** unklare Fehler bei nicht unterstützten Typen → klare Meldung statt
  stillem Verschlucken.

### 2 — Transkript
- **System:** wandelt das Dokument in durchsuchbaren Text um (inkl. Struktur:
  Kapitel, Inhaltsverzeichnis, wo vorhanden).

### 3 — Transformation (Analyse)
- **System:** extrahiert Felder/Struktur gemäß **`pdfanalyse`** (Titel,
  Autor:innen, Jahr, Abstract, Themen, Kapitel, Provenienz, Confidence …).
- **Warum:** aus Rohtext werden strukturierte, anzeigbare Daten.

### 4 — Abnahme (Human-in-the-Loop) ⭐
- **Mensch:** prüft das Ergebnis und **korrigiert fehlende/falsche Metadaten**.
- **System:** zeigt **genau die Felder zur Abnahme, die der Ziel-DetailViewType
  als Pflicht definiert** (`VIEW_TYPE_REGISTRY.requiredFields`) — **systemisch
  abgeleitet**, nicht pro Vorlage diktiert.
- **Warum:** der DetailViewType bestimmt, was im Internet sichtbar ist → seine
  Pflichtfelder sind genau das, was stimmen muss.
- **Falle:** zu viele Felder überfordern; technische Pflichtfelder (z.B.
  `language`, `targetLanguage`) gehören evtl. **nicht** in die menschliche
  Abnahme (→ Offene Fragen).

### 5 — Publikation
- **Mensch:** gibt frei. · **System:** veröffentlicht ins Internet (Story-
  Publikations-Flow), idempotent und erst nach erfolgreicher Abnahme.
- **Warum:** erst geprüfte Inhalte gehen online.

## Bewusst NICHT (damit es niemanden überfordert)

- **Keine** Metadaten-Erfassung von Hand beim Upload.
- **Keine** Abnahme **aller** Felder — nur die Pflichtfelder des Ziel-Renderers.
- **Keine** direkte Veröffentlichung ohne Abnahme (ADR-0004: erst Inbox/Freigabe).
- **Keine** Audio/Media in diesem Flow.

## Erfolgskriterien

> `auto` = im Code testbar · `auto-🎯` = sobald Abnahme/Inbox gebaut · `UI`.

- [ ] `auto` Akzeptierte Typen: PDF, Excel, Markdown; Audio/Media werden
  abgelehnt (klare Meldung).
- [ ] `auto-🎯` Die Abnahme-Felder eines Ergebnisses = `requiredFields` seines
  DetailViewType (aus `VIEW_TYPE_REGISTRY`), nicht hartkodiert.
- [ ] `auto-🎯` Ohne Abnahme erfolgt **keine** Publikation.
- [ ] `UI` Upload mehrerer Dokumente funktioniert; Fortschritt sichtbar.
- [ ] `UI` Analyse-Ergebnis ist vor Publikation editierbar.
- [ ] `UI` Nach Freigabe ist das Dokument über die öffentliche Library erreichbar.

## Offene Fragen

- **Welche Pflichtfelder zur Abnahme?** Alle `requiredFields` des DetailViewType,
  oder nur die **inhaltlichen** (technische wie `language`/`targetLanguage`
  ausnehmen)? → vermutlich „nur inhaltliche".
- **Confidence-getrieben?** `pdfanalyse` liefert Confidence pro Feld — sollen
  Felder mit niedriger Confidence in der Abnahme **hervorgehoben** werden?
- **Excel/Markdown:** Nutzen sie denselben `pdfanalyse`-Extractor oder eigene?
- **Sammel-Abnahme:** ein Review pro Dokument, oder Stapel-Freigabe mehrerer?
- Verhältnis zu ADR-0004: ist die „Inbox" der Ort dieser Abnahme?
