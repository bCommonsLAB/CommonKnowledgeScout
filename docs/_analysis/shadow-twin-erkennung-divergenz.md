# Analyse: Shadow-Twin-Erkennung – Divergenz zwischen Übersicht und Transformation-Tab

## Problem

Artefakte (Transkripte, Transformationen) werden im **Übersicht-Tab** korrekt angezeigt,
aber der **Transformation-Tab** und **Transkript-Tab** zeigen "Keine Transformationsdaten vorhanden".

## Datenfluss-Analyse

### Pfad A: Übersicht-Tab (funktioniert)

```
ArtifactInfoPanel
  → GET /api/library/${libraryId}/shadow-twins/${sourceId}
    → getAllArtifacts({ libraryId, sourceId })
      → MongoDB: col.findOne({ libraryId, sourceId })
        → IMMER MongoDB, unabhängig von primaryStore
```

**Datei:** `src/components/library/shared/artifact-info-panel.tsx` (Zeile 90)

### Pfad B: Transformation-Tab (scheitert)

```
file-list.tsx → useShadowTwinAnalysis()
  → batchResolveArtifactsClient()
    → POST /api/library/${libraryId}/artifacts/batch-resolve
      → getShadowTwinConfig(library).primaryStore
        ├─ 'mongo'     → getShadowTwinsBySourceIds() → MongoDB ✓
        └─ 'filesystem' → resolveArtifact() → Filesystem-Scan ✗
```

**Dateien:**
- Hook: `src/hooks/use-shadow-twin-analysis.ts` (Zeile 234)
- API: `src/app/api/library/[libraryId]/artifacts/batch-resolve/route.ts` (Zeile 244)
- Config: `src/lib/shadow-twin/shadow-twin-config.ts` (Zeile 26)

### Das Ergebnis in file-preview.tsx

```typescript
// Zeile 539-540: Liest aus shadowTwinStateAtom
const shadowTwinStates = useAtomValue(shadowTwinStateAtom);
const shadowTwinState = shadowTwinStates.get(item.id);

// Zeile 583-584: transformItem wird null wenn transformed fehlt
if (!shadowTwinState?.transformed?.id) {
  setTransformItem(null) // → "Keine Transformationsdaten vorhanden"
}
```

## Root Cause

**`getShadowTwinConfig()` gibt `'filesystem'` als Default zurück** (Zeile 26):

```typescript
const primaryStore: ShadowTwinPrimaryStore = cfg?.primaryStore || 'filesystem'
```

Wenn die Library kein explizites `config.shadowTwin.primaryStore: 'mongo'` gesetzt hat,
nutzt `batch-resolve` den **Filesystem-Pfad**. Dieser sucht im Storage (OneDrive/Nextcloud/lokal)
nach Markdown-Dateien mit bestimmten Namenskonventionen.

**Aber:** Die Pipeline (Job-System) speichert Artefakte primär in **MongoDB**.
Wenn die Filesystem-Synchronisation nicht stattgefunden hat, existieren die Dateien
nur in MongoDB – und `batch-resolve` findet sie nicht.

**`ArtifactInfoPanel` umgeht dieses Problem**, weil es IMMER direkt MongoDB abfragt,
unabhängig von `primaryStore`.

## Lösungsvorschläge

### Variante 1: MongoDB-Fallback in batch-resolve (empfohlen)

Wenn der Filesystem-Pfad kein Artefakt findet, zusätzlich MongoDB prüfen.
Dies ist der geringste Eingriff und behebt die Inkonsistenz direkt.

**Änderung in:** `batch-resolve/route.ts` – nach dem Filesystem-Scan einen MongoDB-Fallback
für nicht gefundene Artefakte hinzufügen.

**Vorteil:** Minimaler Eingriff, backward-compatible.
**Nachteil:** Doppelte Abfrage bei nicht vorhandenen Artefakten (Performance).

### Variante 2: primaryStore auf 'mongo' setzen

Die Library-Konfiguration explizit auf `primaryStore: 'mongo'` umstellen.
Dann nutzt `batch-resolve` direkt den MongoDB-Pfad.

**Vorteil:** Kein Code-Change nötig.
**Nachteil:** Muss pro Library gemacht werden, löst nicht das strukturelle Problem.

### Variante 3: Unified Resolution Layer

Einen einheitlichen Resolver erstellen, der IMMER beide Quellen (MongoDB + Filesystem)
prüft und das neueste Artefakt bevorzugt. Wird von allen Komponenten genutzt.

**Vorteil:** Konsistentes Verhalten überall.
**Nachteil:** Größerer Refactoring-Aufwand.

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/app/api/library/[libraryId]/artifacts/batch-resolve/route.ts` | API mit primaryStore-Weiche |
| `src/hooks/use-shadow-twin-analysis.ts` | Client-Hook, setzt shadowTwinStateAtom |
| `src/components/library/file-preview.tsx` | Liest shadowTwinState.transformed |
| `src/components/library/shared/artifact-info-panel.tsx` | Immer-MongoDB-Abfrage |
| `src/lib/shadow-twin/shadow-twin-config.ts` | Default primaryStore='filesystem' |
| `src/lib/shadow-twin/shadow-twin-select.ts` | Artefakt-Auswahl aus Mongo-Dokument |

## Nächster Schritt

Vor der Implementierung: **Diagnose bestätigen** durch temporären Debug-Log in
`batch-resolve/route.ts`, der zeigt:
1. Welcher `primaryStore`-Wert aktiv ist
2. Ob `resolveArtifact()` null zurückgibt für die betroffene Datei
3. Ob `getShadowTwinsBySourceIds()` Ergebnisse liefert für dieselbe sourceId
