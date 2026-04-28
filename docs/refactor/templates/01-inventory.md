# Inventur: Modul `templates`

Stand: 2026-04-27. Welle 2.2 (Plan §5 Welle 2 Verarbeitung, 2. von 3).

## 1. Modul-Health

| Modul | Files | Max-Zeilen (Datei) | > 200 Zeilen | hat Tests | any | leere catch{} | use client |
|---|---:|---|---:|---|---:|---:|---:|
| `templates` | 12 | 870 (`template-frontmatter-utils.ts`) | **7** | ja | 0 | **5** | 0 |

Vergleich mit Welle 2.1:

| Modul | Files | Max-Zeilen | > 200 Zeilen | leere catch{} |
|---|---:|---:|---:|---:|
| `secretary` (nach Welle 2.1) | 8 | 1.192 | 3 | 0 |
| **`templates`** | **12** | **870** | **7** | **5** |

`templates` ist breiter (12 Files), aber kein File ist so dramatisch
gross wie `secretary/client.ts`. Hauptlast: 5 leere Catches in
`template-service.ts` (Telemetry-Pfad).

## 2. Files in `src/lib/templates/`

| Datei | Zeilen | hat direkten Test | Funktion |
|---|---:|---|---|
| `template-frontmatter-utils.ts` | 869 | nein (indirekt via image-field-keys) | YAML/Frontmatter-Parsing inkl. `creation`-Block injection/extract |
| `template-service-mongodb.ts` | 350 | nein | MongoDB-Service-Layer |
| `template-service.ts` | 348 | nein | File-basierter Legacy-Service mit Trace-Events (5x catch{}) |
| `template-types.ts` | 342 | n/a | Pure Types |
| `library-creation-config.ts` | 267 | ja (`library-creation-config-builtin.test.ts`) | Library-Creation-Config-Logik |
| `template-parser.ts` | 266 | ja (`pdfanalyse-commoning-template-parsing.test.ts`) | Template-Parser |
| `builtin-creation-templates.ts` | 204 | ja (`builtin-creation-templates.test.ts`) | Built-in Templates (audio-transcript-de etc.) |
| `template-import-export.ts` | 127 | nein | Import/Export-Helper fuer Storage |
| `template-service-client.ts` | 117 | nein | Client-Side Wrapper |
| `placeholders.ts` | 62 | nein | Placeholder-Extraktion + Heading-Zuordnung |
| `template-options.ts` | 53 | ja (`template-options.test.ts`) | mergeTemplateNames |
| `detail-view-type-utils.ts` | 42 | nein | getDetailViewType |

## 3. Bestands-Tests

| Test-Datei | Zeilen | Testet |
|---|---:|---|
| `tests/unit/templates/builtin-creation-templates.test.ts` | 27 | `getBuiltinCreationTemplate`, `listBuiltinCreationTemplates`, `isBuiltinCreationTemplateName` |
| `tests/unit/templates/creation-image-fields.test.ts` | 93 | Image-Field-Logik (in `template-frontmatter-utils.ts`) |
| `tests/unit/templates/image-field-keys.test.ts` | 75 | Image-Field-Keys |
| `tests/unit/templates/library-creation-config-builtin.test.ts` | 51 | `library-creation-config.ts` Built-in-Pfad |
| `tests/unit/templates/pdfanalyse-commoning-template-parsing.test.ts` | 36 | `template-parser.ts` Spezialfall |
| `tests/unit/templates/template-options.test.ts` | 44 | `template-options.ts` |

## 4. Aufrufer

`src/lib/templates/` wird genutzt von:

- `external-jobs/phase-template.ts`, `template-run.ts`
- `secretary/client.ts`, `secretary/adapter.ts` (via `serializeTemplateWithoutCreation`)
- `creation-wizard/**`
- `library/file-preview.tsx`, `library/template-management.tsx`
- `chat/orchestrator.ts`
- API-Routen: `src/app/api/templates/**`

## 5. Hot-Spots fuer Welle 2.2

### 5.1 Pflicht-Char-Tests

Files ohne direkten Test, die Welle 2.2 abdecken sollte:

| Datei | Begruendung | Geschaetzte Tests |
|---|---|---:|
| `template-service.ts` | 5 catch{}, 7 oeffentliche Funktionen, 0 Tests | 6-8 |
| `template-service-mongodb.ts` | 7 oeffentliche Funktionen, 0 Tests | 4-6 |
| `template-frontmatter-utils.ts` | Hauptlast (869 Z.), 2 oeffentliche Funktionen + viele Helper. Indirekt via 3 Tests, aber nicht direkt | 4-6 |
| `placeholders.ts` | 3 pure Funktionen, 0 Tests | 4-6 |
| `detail-view-type-utils.ts` | 1 pure Funktion, 0 Tests | 2-3 |
| `template-import-export.ts` | 3 oeffentliche Funktionen, 0 Tests | 3 |
| `template-service-client.ts` | 3 oeffentliche Funktionen, 0 Tests | 3 |

### 5.2 Pflicht-Fix Silent Catches

5 leere `catch {}` in `template-service.ts` Z. 148, 170, 191, 208, 237.
Alle umgeben Telemetry-Aufrufe (`repo.traceAddEvent`). Fix: Logging
statt Schweigen.

### 5.3 Files > 200 Zeilen

7 von 12 Files. Voller Split aller > 200-Zeilen-Files ist nicht Welle-
Pflicht — aber `template-service.ts` (348 Z., mit 5 catch{}) sollte
mind. den Telemetry-Pfad als Helper extrahieren.
