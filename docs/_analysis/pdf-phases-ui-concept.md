---
title: PDF‑Spezialansicht – Phasen‑UI (Konzept, Wireframes, Umsetzungsplan)
status: draft
lastUpdated: 2025-09-06
---

## Ziele und Rahmenbedingungen
- Nur für PDFs aktiv (mimeType = application/pdf), alle anderen Dateitypen bleiben unverändert.
- Minimal-invasiv: bestehende Library‑Ansicht bleibt; nur bei Auswahl eines PDFs erscheint rechts die Phasen‑Sicht.
- FileTree wird bei PDFs standardmäßig eingeklappt (über Toolbar toggelbar), links bleibt die File‑Liste.
- Rechts: Zwei‑Pane‑Vorschau, je Phase wechselnde Paare, klare CTAs pro Phase.
- Human‑in‑the‑Loop: Übergang von Phase 1→2→3 jeweils paarweise sichtbar (links „Quelle“, rechts „Ergebnis“).

## Wireframes (ASCII, Desktop)

Phase‑Header (rechts):
```
[1 Extraktion] [2 Metadaten] [3 Ingestion]    Status: 1● 2○ 3○    [Template ▼]    [Start/Neu starten]
```

Phase 1 (links PDF, rechts Markdown):
```
┌───────────────────────────── rechter Bereich (Split) ─────────────────────────────┐
│┌────────────── links (Quelle) ───────────────┐┌────────────── rechts (Ergebnis) ──────────────┐│
││ PDF Preview (Seiten-Navigation, Zoom)      ││ Markdown (Shadow‑Twin, read‑only)             ││
││                                             ││ Frontmatter minimal sichtbar                  ││
│└─────────────────────────────────────────────┘└───────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

Phase 2 (links Markdown, rechts Metadaten):
```
┌───────────────────────────── rechter Bereich (Split) ─────────────────────────────┐
│┌────────────── links (Quelle) ───────────────┐┌────────────── rechts (Ergebnis) ──────────────┐│
││ Markdown (Shadow‑Twin, scroll‑sync)        ││ Metadaten                                    ││
││                                             ││  • Frontmatter (vollständig, flach)          ││
││                                             ││  • Kapitel-Tabelle (Nr, Titel, Level, …)     ││
││                                             ││  • TOC-Tabelle (Titel, Seite, Level)         ││
││                                             ││  • Geo (optional): Gemeinden/Täler, Mentions  ││
│└─────────────────────────────────────────────┘└───────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

Phase 3 (links Metadaten, rechts Report):
```
┌───────────────────────────── rechter Bereich (Split) ─────────────────────────────┐
│┌────────────── links (Quelle) ───────────────┐┌────────────── rechts (Ergebnis) ──────────────┐│
││ Metadaten (wie oben, scroll‑sync Quelle)   ││ Ingestion‑Report (Pinecone)                    ││
││                                             ││  • Upsert-Counts (chunks/doc)                  ││
││                                             ││  • Index/Namespace/Dimension                   ││
││                                             ││  • Letztes Upsert‑Datum, docId = fileId‑doc    ││
││                                             ││  • Fehlertexte (falls aufgetreten)             ││
│└─────────────────────────────────────────────┘└───────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

Mobile (Stack):
```
[Phase‑Tabs: 1 | 2 | 3]
▼ Aktive Phase
──────────────────────────────────────────────
Pane A (Quelle)
──────────────────────────────────────────────
Pane B (Ergebnis)
```

## Statusmodell (sichtbare Badges im Stepper)

| Phase | completed (Beispiel‑Signale) | in_progress | failed | pending |
|---|---|---|---|---|
| 1 Extraktion | Shadow‑Twin .md existiert ODER Job‑Step extract_pdf/transform_template = completed | passender Job aktiv | letzter Job‑Step failed | sonst |
| 2 Metadaten | Frontmatter vollständig ODER cumulativeMeta.finalMeta vorhanden | passender Job aktiv | letzter Job‑Step failed | sonst |
| 3 Ingestion | Pinecone Doc existiert (kind='doc', id = fileId‑doc) ODER job.ingestion.docUpserts > 0 | passender Job aktiv | letzter Job‑Step failed | sonst |

Hinweis: „existiert“ kann primär über Jobdaten abgeleitet werden; optionaler „Verifizieren“‑Button kann Pinecone prüfen.

## Interaktionen & CTAs
- Phase auswählen → rechts wechselt Paaransicht.
- CTA „Start/Neu starten“ pro Phase:
  - Phase 1: PDF→Markdown auslösen (erzwingt ggf. Template‑Default)
  - Phase 2: LLM/Template‑Analyse (Template‑Select sichtbar), erzwingt Phase‑1 falls fehlt
  - Phase 3: Ingestion (RAG), erzwingt Phase‑1/2 falls fehlen
- Nach Start: kompakter Fortschritt/Logs im rechten Pane; Stepper‑Badges aktualisieren sich.

## Scroll‑Synchronisation (Konzept)
- Datenanker: Markdown enthält Seitenmarker (z. B. `<!-- page:12 -->`) oder `toc`/Kapitelanker; Mapping `pageIndex ↔ markdownOffset` wird beim Laden berechnet.
- Technik: IntersectionObserver + throttled Scroll‑Events; globales Atom `activeViewportAnchor`; Guard‑Flag `isSyncing` verhindert Rückkopplungen.
- Fallback: Ohne Marker heuristische Zuordnung via TOC/Überschriften.

## Implementation Plan (minimal‑invasiv)

### Komponenten (neu)
- PhaseStepper: zeigt 1/2/3 mit Badges; onSelect(phase).
- PdfPhaseView: orchestriert Paar‑Rendering je Phase, hält Scroll‑Sync.
- PanelMarkdown: read‑only Shadow‑Twin‑Ansicht, zeigt minimales Frontmatter.
- PanelMetadata: Frontmatter vollständig + Tabellen (Kapitel, TOC, optional Geo).
- PanelReport: Ingestion‑Report (bestehende Job‑UI eingebettet, kompakt).

### Integration (bestehendes wiederverwenden)
- DocumentPreview (PDF) links in Phase 1, Scroll‑Sync‑Hooks hinzufügen.
- MarkdownPreview (read‑only) als PanelMarkdown.
- JobReportTab als PanelReport (kontextualisiert, schmale Variante).

### State & Logik
- Atoms: `activePhaseAtom`, `phaseStatusAtom` (derived), `viewportAnchorAtom` (Sync), `paneWidthAtom` (persistiert).
- Ableitung Status aus: Dateisystem (Shadow‑Twin vorhanden), ExternalJobs (steps/status), optional Pinecone‑Check.

### Dialog „PDF transformieren“
- Checkboxen: [ ] Phase 1  [ ] Phase 2  [ ] Phase 3; Template‑Select sichtbar wenn Phase 2 gewählt.
- Orchestrierung: gewählte Phase(n) starten, Vorbedingungen sicherstellen.

### Routen/API (Re‑Use)
- Start: POST /api/secretary/process-pdf (parameters: useIngestionPipeline=false/true, template)
- Callback: POST /api/external/jobs/[jobId]
- Optional: leichte HEAD/GET‑API `doc-exists` (prüft `${fileId}-doc`), ansonsten Job.ingestion verwenden.

### A11y/UX
- Tastatur‑Navigation der Phasen; ARIA‑Labels an Badges/Tabs.
- Tooltips für Status/Fehler; klare Kontraste.

### Risiken & Gegenmaßnahmen
- Scroll‑Sync Genauigkeit: Marker notwendig → im Template/Transform sicherstellen; Fallback‑Heuristik.
- Zustandsdrift zwischen Job und Realität: „Verifizieren“‑Action triggert Pinecone‑Check on demand.
- UI‑Komplexität: nur bei PDFs aktiv; Standardansichten bleiben unverändert.

### Tests
- Unit: Statusableitung (Signale → Badge), Marker‑Parsing, Sync‑Mapping.
- Integration: Phase‑Start triggert korrekte Jobs; Report/Status aktualisieren sich.
- E2E: Phase 1→2→3 mit Review; Fehlerpfade (Pinecone 400) sichtbar.

### Rollout
- Feature‑Flag „pdfPhasesUI“ per Library.
- Zuerst intern testen (kleine Dokumentmenge), dann breit aktivieren.

### Definition of Done
- PDFs zeigen Phase‑UI mit drei Paaren, korrektem Status und CTAs.
- Scroll‑Sync funktioniert mit Markern; Fallback degradiert würdevoll.
- Keine Änderungen am Verhalten nicht‑PDF Dateien.


