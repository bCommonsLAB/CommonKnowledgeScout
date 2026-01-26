# Entscheidung: Story Creator eliminieren und Pipeline direkt in Preview integrieren

**Datum:** 2026-01-26  
**Status:** Implementiert  
**Entscheidung:** Variante A

## Problem

Der Story Creator existiert als separate Route (`/library/story-creator`), die faktisch nur eine Toolbar (`FlowActions`) und einen Viewer (`ShadowTwinViewer`) rendert. Dies führt zu:

- **Doppelte Funktionalität**: Der Preview-Mode zeigt bereits alle drei Phasen (Transkript, Transformation, Story) als Tabs an
- **Zeitverlust**: User muss zwischen Preview und Story Creator wechseln
- **Kognitive Last**: Zwei verschiedene Modi für dieselbe Aufgabe

## Varianten

### Variante A: Pipeline direkt im Preview + gemeinsame Pipeline-Runner-Logik ✅

**Was:** Preview bekommt "Jetzt erstellen"-Buttons bei fehlenden Phasen, die den `PipelineSheet` Dialog öffnen. `FlowActions` und Preview teilen sich eine extrahierte `runPipelineForFile()`-Funktion.

**Pro:**
- Keine parallelen Modi
- Minimale kognitive Last
- Kein Code-Duplikat der Enqueue-Logik

**Contra:**
- Kleiner Refactor nötig (Logik aus `flow-actions.tsx` herauslösen)

### Variante B: `FlowActions` im Preview wiederverwenden

**Was:** Preview rendert intern `FlowActions` (oder einen abgespeckten Wrapper), nutzt deren `PipelineSheet`-State und `runPipeline()` unverändert.

**Pro:**
- Weniger Refactor

**Contra:**
- `FlowActions` bringt viel Toolbar-UI/Query-Param-Logik mit
- Integration in `file-preview.tsx` wird schnell "komisch"

### Variante C: Neues kleines "PipelineLauncher"-Modul + geringe Duplikation

**Was:** Preview nutzt einen neuen minimalen Launcher, der die 3–4 Enqueue-Calls lokal abbildet (aus `flow-actions.tsx` kopiert/vereinfacht).

**Pro:**
- Schnell implementierbar

**Contra:**
- Duplikation; driftet mit der Zeit auseinander

## Entscheidung

**Variante A** wurde gewählt, weil sie den Story-Creator sauber ersetzt und Duplikation vermeidet.

## Konsequenzen

1. **Route entfernt**: `/library/story-creator` gibt 404
2. **Neue UI**: Preview zeigt "Jetzt erstellen"-Buttons bei fehlenden Phasen
3. **Vorauswahl**: Dialog ist je nach fehlender Phase vorselektiert:
   - Transkript fehlt → nur Extract/Transkription aktiv
   - Transformation fehlt → nur Transformation aktiv (Template erforderlich)
   - Story fehlt → nur Ingestion aktiv
4. **Job-Status**: Preview zeigt Job-Status (queued/running/completed/failed) wie im Job Monitor, aber ohne Auto-Refresh der Shadow-Twin-Artefakte (nur manueller Refresh)

## Technische Details

- Pipeline-Runner-Logik wurde in `src/lib/pipeline/run-pipeline.ts` extrahiert
- `PipelineSheet` unterstützt jetzt optionale `defaultSteps` Props
- Preview nutzt denselben SSE-Mechanismus (`/api/external/jobs/stream`) wie der Job Monitor für Status-Updates
