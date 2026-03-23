# Legacy-Dialoge – Prüfprotokoll (abgeschlossen)

Die drei früheren Batch-Dialoge in der Library-Dateiliste wurden **alle entfernt**. Dieses Dokument fasst den **Endstand** zusammen und ersetzt das frühere Prüfprotokoll.

| Dialog | Status |
|--------|--------|
| `TranscriptionDialog` | **entfernt** – Transkription über Vorschau / Pipeline |
| `TransformationDialog` | **entfernt** – Template über External Jobs / `phase-template.ts` |
| `IngestionDialog` | **entfernt** – kein Batch-Ingest mehr aus der Listen-Toolbar |

## Was in der Dateiliste bleibt

- **Sammel-Transkript** (`POST /api/library/[libraryId]/composite-transcript`)
- **Bulk-Löschen**
- Checkbox-Auswahl: `selectedBatchItemsAtom` (Audio/Video), `selectedTransformationItemsAtom` (Text/Dokumente/Ordner)

Zusätzlich entfernt (gehörte nicht zu den drei Dialogen, war aber derselbe „schnell Transkript“-Gedanke): das **Plus pro Zeile** („Transkript erstellen“) in `FileRow` innerhalb von `file-list.tsx` – der Klick war nur ein TODO-Stubs; Transkript/Extract nur noch über **Vorschau / Pipeline**.

## Publishing / Ingest woanders

- Route **`POST /api/chat/[libraryId]/ingest-markdown`** bleibt bestehen.
- Aufrufer u. a.: **`creation-wizard.tsx`**, Vorschau- und Job-bezogene Aktionen – **nicht** mehr ein `IngestionDialog` in `library.tsx`.

## Entfernte Dateien / Symbole (Referenz)

- `src/components/library/transcription-dialog.tsx`
- `src/components/library/transformation-dialog.tsx`
- `src/components/library/combined-chat-dialog.tsx`
- `src/components/library/ingestion-dialog.tsx`
- `src/lib/transform/batch-transform-service.ts`
- Atoms: `transcriptionDialogOpenAtom`, `transformationDialogOpenAtom`, `ingestionDialogOpenAtom`, `baseTransformOptionsAtom`, … (siehe Git-Historie / `transcription-options.ts`)

## Verweise

- `docs/analysis/pipeline-system-map.md`
- `docs/analysis/pipeline-redundancy-audit.md`
- `docs/analysis/rules-gap-analysis.md`
