# Filesystem-Contract: Event + Testimonials + Final-Runs

Datum: 2026-01-11  
Status: Arbeitsgrundlage (für Implementierung der 3 Wizards)

## Ziel

Wir brauchen eine **klare, stabile Dateistruktur**, damit drei zusammenhängende Flows sauber arbeiten:

- **Flow A** legt einen Event-Container an (und indexiert den Original-Event).
- **Flow B** schreibt Testimonials (Audio + Metadaten) **in den Event-Container** (filesystem-only, keine Ingestion).
- **Flow C** erzeugt versionierte Final-Runs (filesystem-only) und kann optional einen Final-Run **publizieren** (Index-Swap).

Wichtig: **Im Filesystem wird nichts überschrieben** (Finalisierung erzeugt neue Dateien). Der „Replace“-Effekt passiert nur im Index.

## Begriffe

- **Event-Container**: Ein Storage-Ordner, der alle Event-bezogenen Dateien enthält.
- **Original-Event-Datei**: Das Markdown, das aus Flow A entsteht.
- **Final-Run**: Ein versionierter Output aus Flow C (entsteht mehrfach, wird nicht automatisch ingestiert).

## Ordnerstruktur (minimal, kompatibel mit aktuellem Wizard-Container-Modus)

Der Creation-Wizard kann bereits `createInOwnFolder=true` und speichert dann:

- Ordnername = Dateiname ohne Extension
- Source-Dateiname = Dateiname (z.B. `mein-event.md`)
- Result: `mein-event/mein-event.md`

Daraus leiten wir den Contract ab:

```
<eventSlug>/                       # Event-Container (Foldername == slug)
  <eventSlug>.md                   # Original-Event (Flow A), wird ingestiert

  testimonials/                    # Child-Assets (Flow B), filesystem-only
    <testimonialId>/               # z.B. uuid
      audio.webm|wav|mp3|m4a       # Originalaufnahme
      meta.json                    # Metadaten (speakerName?, consent?, createdAt, etc.)
      transcript.md                # optional, wenn später transkribiert

  finals/                          # Output aus Flow C, filesystem-only bis Publish
    run-<timestamp>/               # versionierter Run
      event-final.md               # Final-Entwurf (mit slug des Originals)
      final.json                   # Run-Metadaten (usedTestimonials[], generatedAt, etc.)
```

## Frontmatter-Contract (für Event Markdown)

### Pflichtfelder (Original + Final)

- `docType: event`  
  Wird für Typisierung/Filter/Detail-Render genutzt.
- `detailViewType: session`  
  Für Detail-Renderer (SessionDetail UI).
- `slug: <eventSlug>`  
  Muss stabil sein. Final-Publish verwendet **denselben** slug.

### Pflichtfelder (Final-Runs)

- `originalFileId: <fileId>`  
  **Referenz auf den indexierten Original-Event** (wird für Index-Swap benötigt).
- `finalRunId: <runId>`  
  Eindeutige Kennung des Runs (z.B. timestamp oder uuid).
- `eventStatus: finalDraft` (oder `finalPublished` nach Publish)  
  UI-Steuerung (CTA anzeigen, Status-Label).

### Empfohlene Felder (Original)

- `eventStatus: open`  
  UI-Label, zeigt dass Testimonials noch gesammelt werden.

## ID-/Slug-Generierung

- Dateiname/Slug kann über `buildCreationFileName()` erzeugt werden:  
  `src/lib/creation/file-name.ts` (Windows-sicher, diakritika-safe).

## Ingestion-/Index-Contract

- **Original-Event** wird ingestiert (damit er in Explorer sichtbar ist).
- **Testimonials** werden **nicht ingestiert** (filesystem-only).
- **Final-Run** wird erst ingestiert, wenn explizit „Publish final“ ausgeführt wird.
  - Publish final = ingest final + delete original from index (docs/delete).

## Offene Punkte (bewusst offen gelassen)

- Audio-Format: wir akzeptieren mehrere (`webm`, `wav`, `m4a`, `mp3`). Standard hängt von Recorder-Komponente ab.
- Welche Metadaten in `meta.json` minimal sind (Consent/Name/etc.) – hängt von UX-Formular ab.

