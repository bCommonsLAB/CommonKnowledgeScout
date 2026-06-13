# Bestandsaufnahme: was vom Upload→Analyse→Abnahme→Publikation-Flow heute existiert

> Companion zu [`dokument-upload-analyse-publizieren.md`](dokument-upload-analyse-publizieren.md).
> Code-Inventur 2026-06-02 (gegen Branch `claude/knowledge-scout-wizard-ux-yjOwS`).
> Datei-Verweise sind Funde der Inventur — vor Umsetzung am aktuellen Code prüfen.

## In einfacher Sprache

Das **Hochladen** und vor allem das **Analysieren** sind schon weitgehend
gebaut. Das **Veröffentlichen** existiert in Teilen. Was **fehlt**, ist genau das
Herzstück deines Wunsches: das **Abnehmen vor dem Veröffentlichen** (die „Inbox"
aus ADR-0004) — das gibt es nur als Plan, nicht im Code. Außerdem: **Excel** wird
noch nicht erkannt, und die **Confidence** (Sicherheit pro Feld) liefert die
Analyse zwar, aber **keine Oberfläche hebt sie heute hervor**.

## Pro Baustein

### 1 — Upload · 🟡 teilweise
- **Da:** Drag&Drop-Upload (`src/components/library/upload-area.tsx`,
  `upload-dialog.tsx`), Typ-Erkennung `detectFileKind()`
  (`src/lib/integration-tests/pdf-upload.ts`): **PDF, Markdown, Text, HTML,
  Audio, Bild**.
- **Fehlt:** **Excel (.xlsx)** wird nicht erkannt/verarbeitet. Audio/Video laufen
  über eigene Routen (`/api/secretary/process-audio|process-video`).
- **Für den Flow:** Excel-Pfad ergänzen (falls benötigt); Audio/Media bewusst
  ablehnen mit klarer Meldung.

### 2 — Analyse · 🟢 fertig
- **Da:** mehrstufige Pipeline `src/lib/external-jobs/phase-template.ts`
  (Transformation, Kapitel-Erkennung, Secretary-Aufruf), `phase-ingest.ts`
  (RAG-Ingestion), `src/lib/chat/ingestion-service.ts` (`upsertMarkdown`).
  Media-Validator gegen erfundene Datei-URLs (phase-template ~Z. 932).
  Registry-Validierung `validateMetadataForViewType()`.
- **Für den Flow:** nutzbar wie es ist; liefert die strukturierten Felder.

### 3 — Confidence · 🟡 teilweise
- **Da:** echte Confidence + UI nur bei **diva-texture**
  (`material-classification`-Route; `diva-texture-card.tsx` färbt ≥0.9 grün,
  ≥0.7 orange). `autoApplyConfidenceThreshold` existiert als Library-Config.
- **Wichtig:** Das `pdfanalyse`-Schema **produziert** bereits Confidence pro Feld
  (im Antwort-JSON), aber **keine Abnahme-Oberfläche** nutzt sie.
- **Für den Flow (Entscheidung: unsichere Felder hervorheben):** die vorhandenen
  Confidence-Daten in der Abnahme-Ansicht **generisch** sichtbar machen — das
  diva-texture-Muster ist die Vorlage.

### 4 — Publikation · 🟡 teilweise
- **Da:** Publish-Status (`/api/chat/[libraryId]/docs/publish`), Site-Publish
  nach Azure (`/api/library/[libraryId]/publish-site`), Index-Swap/Finalisierung
  (`/api/library/[libraryId]/events/publish-final`).
- **Hinweis:** Die „3 Stufen" (Transkript → Transformation → Publikation) sind als
  Code eher Analyse-Pipeline + Publish-Status + Site-Snapshot — kein einzelner
  benannter 3-Stufen-Flow.
- **Für den Flow:** Publikation erst **nach** Abnahme auslösen (heute fehlt das
  Gate).

### 5 — Abnahme / Inbox (ADR-0004) · 🔴 fehlt ganz
- **Nur Plan:** `docs/adr/0004-...`. **Kein** Code: keine `wizard_submissions`-
  Collection, keine `contributor`-Rolle, kein Freigabe-Gate.
- **Heute stattdessen:** direktes Schreiben + Datei-Move
  (`src/lib/creation/wizard-artifact-promotion.ts`).
- **Für den Flow:** **das ist das Kern-Bauteil** deines Wunsches („abnehmen
  müssen"). Hier liegt die größte Lücke.

### 6 — Pflichtfelder · 🟡 teilweise
- **Da:** `VIEW_TYPE_REGISTRY.requiredFields` pro Renderer
  (`src/lib/detail-view-types/registry.ts`). `wizardOnlyMetadataKeys`
  (z.B. `filename`) trennt einzelne Wizard-Felder.
- **Fehlt:** **keine** zentrale „System-/technische-Felder"-Liste (`language`,
  `targetLanguage`, `slug`, `docType` …). Genau die brauchen wir, um aus
  `requiredFields` die **inhaltlichen** zu gewinnen (deine Entscheidung).
- **Für den Flow:** kleine, zentrale Ausschluss-Liste „technische Felder"
  definieren → `inhaltlichePflichtfelder(viewType) = requiredFields − technische`.

## Gesamtbild & Vorschlag für die Reihenfolge

| Baustein | Status |
|---|---|
| Analyse | 🟢 fertig |
| Upload | 🟡 (Excel fehlt) |
| Publikation | 🟡 (Gate fehlt) |
| Confidence | 🟡 (Daten da, UI fehlt) |
| Pflichtfelder inhaltlich | 🟡 (Ausschluss-Liste fehlt) |
| **Abnahme / Inbox** | 🔴 **fehlt — Herzstück** |

**Kleinster sinnvoller erster Schritt (Vorschlag):** die **inhaltlichen
Pflichtfelder** generisch ableiten (Baustein 6) — klein, testbar, rein, und
Voraussetzung für die Abnahme-Ansicht. Danach die **Abnahme/Inbox** (Baustein 5,
ADR-0004) als eigentliches Kernstück, mit Confidence-Hervorhebung (Baustein 3).
