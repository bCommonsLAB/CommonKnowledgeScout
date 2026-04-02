# Built-in Creation Templates (Variante A)

## Entscheidung

Standardvorlagen für „Content erstellen“ liegen **zentral im Code** (`src/lib/templates/builtin-creation-templates.ts`), nicht als MongoDB-Seed pro Library.

## Merge-Regel

- Creation-Typen aus MongoDB werden geladen.
- Built-ins werden ergänzt, **außer** ein Library-Template hat denselben **`name`** / `templateId` → dann gewinnt MongoDB.

## Config-API

`GET /api/templates/[templateId]/config?libraryId=…` lädt zuerst MongoDB; bei Fehlen fällt die Route auf `getBuiltinCreationTemplate()` zurück.

## Wizard

- `audio-transcript-de` / `file-transcript-de`: keine `process-text`-Extraktion beim Hinzufügen der Datei; Verarbeitung startet beim Klick auf „Weiter“ (`runBuiltinTemplateExtract`).
- Dateiname: Feld `filename` im Edit-Schritt; `wizardOnlyMetadataKeys` verhindert Persistenz im Frontmatter; `buildCreationFileName(..., overrideBaseName)`.

## Tests

- `tests/unit/templates/library-creation-config-builtin.test.ts` – Merge
- `tests/unit/creation/file-name.test.ts` – `overrideBaseName`
