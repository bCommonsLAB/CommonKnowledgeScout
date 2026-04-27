# Characterization Tests: Modul `templates`

Stand: 2026-04-27. Welle 2.2, Schritt 3.

## Output

| Test-File | Tests | Testet |
|---|---:|---|
| `tests/unit/templates/placeholders.test.ts` (NEU) | 14 | `extractPlaceholders`, `parseHeadings`, `assignHeadingsToPlaceholders` |
| `tests/unit/templates/detail-view-type-utils.test.ts` (NEU) | 7 | `getDetailViewType` |
| `tests/unit/templates/template-service.test.ts` (NEU) | 18 | `ensureTemplatesFolderId`, `listAvailableTemplates`, `loadTemplate`, `parseTemplateContent`, `loadAndParseTemplate`, `getUxConfig`, `getPromptConfig`, `serializeTemplateWithoutCreation` |
| `tests/unit/templates/builtin-creation-templates.test.ts` (Bestand) | 2 | builtin-creation-templates |
| `tests/unit/templates/creation-image-fields.test.ts` (Bestand) | 4 | image-field-Logik in template-frontmatter-utils |
| `tests/unit/templates/image-field-keys.test.ts` (Bestand) | 3 | image-field-keys |
| `tests/unit/templates/library-creation-config-builtin.test.ts` (Bestand) | 2 | library-creation-config Built-in |
| `tests/unit/templates/pdfanalyse-commoning-template-parsing.test.ts` (Bestand) | 1 | template-parser Spezialfall |
| `tests/unit/templates/template-options.test.ts` (Bestand) | 3 | template-options.mergeTemplateNames |

**Neu in Welle 2.2**: 14 + 7 + 18 = **39 Char-Tests** in 3 neuen
Test-Files. Bestands-Tests bleiben unveraendert (15 Tests, alle `keep`).

## Mock-Strategie

Pro Vertrag aus `templates-contracts.mdc` §7:

| Test-File | Mocks |
|---|---|
| `placeholders.test.ts` | keine — pure Funktionen |
| `detail-view-type-utils.test.ts` | keine — pure Funktion |
| `template-service.test.ts` | Test-Double fuer `TemplateServiceProvider` (manueller Stub mit `vi.fn()` fuer `listItemsById`/`createFolder`/`getBinary`) — kein echtes Storage |

## Was getestet ist

### `placeholders.ts` (pure)

- `extractPlaceholders` — leerer Input, leeres Array, ein Placeholder, mehrere, Trimming, Reject-leerer-Key
- `parseHeadings` — kein Heading, alle Levels, level-Clamp auf 6, start-Offset
- `assignHeadingsToPlaceholders` — kein Placeholder, Default-Path, hierarchischer Pfad, Reihenfolge-Constraint

### `detail-view-type-utils.ts` (pure)

- Default `book`
- Alle 7 gueltigen detailViewType-Werte aus Frontmatter
- Reject unbekannte Werte
- libraryConfig-Fallback
- Frontmatter-Vorrang
- Reject nicht-string

### `template-service.ts` (mit Provider-Mock)

- `ensureTemplatesFolderId` — bestehender Ordner, neu anlegen, Provider-Fehler
- `listAvailableTemplates` — Filter `.md`, leeres Array bei Fehler (nach Altlast-Fix mit Logging, Vertrag bleibt)
- `loadTemplate` — preferredTemplate, pdfanalyse-Default, erstes-Template-Fallback, NotFoundError leer, NotFoundError unbekannt-preferred
- `parseTemplateContent` + `loadAndParseTemplate` — Wrapper-Verhalten
- `getUxConfig` — null ohne creation, populated mit creation
- `getPromptConfig` — laesst creation weg
- `serializeTemplateWithoutCreation` — entfernt creation-Block, mit/ohne systemprompt, ohne Frontmatter

## Nicht getestet (Watchpoints)

- `template-service-mongodb.ts` — MongoDB-Mocks waeren aufwendig, gehoert in eigenen Folge-PR mit Mongo-Test-Setup
- `template-service-client.ts` — Client-Side-Wrapper, fetch-Mocks; Folge-PR
- `template-import-export.ts` — Hat den `listTemplatesInStorage`-Pfad indirekt durch Welle-2.2-Altlast-Fix abgedeckt; importTemplateFromStorage / exportTemplateToStorage in Folge-PR
- `template-frontmatter-utils.ts` (869 Z.) — bereits indirekt durch 3 Bestands-Test-Files getestet (image-field-keys, creation-image-fields, image-field-keys); voller Char-Test in Folge-PR
- `library-creation-config.ts` — Bestands-Test deckt Built-in-Pfad; voller Char-Test in Folge-PR

## DoD-Status nach Schritt 3

| Kriterium | Erwartung | Ergebnis |
|---|---|---:|
| Neue Char-Tests | 15-25 | **39** ✅ uebererfuellt |
| `pnpm test` gruen | ja | ✅ 717/717 |
| Bestands-Tests `keep` unveraendert | ja | ✅ |
