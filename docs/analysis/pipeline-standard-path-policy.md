# Policy: Standardweg Pipeline (Bibliotheks-Archiv)

Kurzfassung für alle, die **Refactors und neue Features** am richtigen Ort platzieren wollen.

**Stand:** dokumentarisch festgehalten; keine Laufzeit-Verifikation dieser Datei.

---

## Standardweg (verbindlich für das Bibliotheks-Archiv)

Für **Transkript**, **Template-Transformation** und **Publishing/Ingestion**, wenn der Nutzer aus **Baum + Liste + Vorschau** (`Library`) arbeitet:

1. UI: `src/components/library/file-preview.tsx` (und ggf. `flow-actions.tsx`)
2. Client: `src/lib/pipeline/run-pipeline.ts`
3. API: `POST /api/pipeline/process` → `src/app/api/pipeline/process/route.ts`
4. Server: External-Job-Orchestrierung unter `src/lib/external-jobs/*` (u. a. Extract, Template, Ingest)

Neue Funktionen, die dieselben Phasen abbilden, sollen **diesen Weg erweitern oder aufrufen**, statt parallele Endpunkte ohne Begründung einzuführen.

---

## Scope (was diese Policy abdeckt und was nicht)

| Im Scope | Außerhalb (bewusst andere Eintritte) |
|----------|--------------------------------------|
| Bibliotheks-Archiv: `library/page.tsx`, `library.tsx`, `file-preview.tsx` | **Creation Wizard** (`creation-wizard.tsx`), u. a. direkter Pfad über `ingest-markdown` |
| Pipeline-Sheet / Job-Fortschritt in der Vorschau | **Event-Monitor** / archivierte Jobs (eigenes UI) |
| Sammel-Transkript aus der Dateiliste (`composite-transcript`) | Einzelkomponenten mit **legacy** `TransformService` (schrittweise angleichen, siehe Systemkarte) |

Die Systemkarte mit Details: [`pipeline-system-map.md`](./pipeline-system-map.md).

---

## Nächste dokumentierte Arbeitsschritte (Reihenfolge)

1. **Code:** Priorität 1 aus [`rules-gap-analysis.md`](./rules-gap-analysis.md) — `PhasePolicies` / `TransformSaveOptions` zentralisieren.  
2. **Code:** `primaryStore` / Shadow-Twin-Details aus der UI kapseln **oder** Rules mit Ausnahmen schärfen (gleiche Analysedatei).  
3. Markdown als Quelle serverseitig: Optionen in [`markdown-processing-pipeline.md`](./markdown-processing-pipeline.md) (Variante B vs. C).

---

## Verwandte Dateien

- `docs/analysis/pipeline-system-map.md`
- `docs/analysis/rules-gap-analysis.md`
- `docs/analysis/pipeline-redundancy-audit.md`
