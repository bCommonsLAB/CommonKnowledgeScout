# Bestands-Audit: Modul `templates`

Stand: 2026-04-27. Welle 2.2, Schritt 0.

## A. Cursor Rules

| Rule-Datei | Bezug | Status | Aktion | Begruendung |
|---|---|---|---|---|
| `../../contracts/template-structure.md` | direkt (Template-Format-Vertrag) | aktuell | keep | Beschreibt Template-Datei-Format (Frontmatter, creation-Block, systemprompt). Kein Code-Vertrag, eher Datenformat |
| `../../contracts/external-jobs-integration-tests.md` | indirekt (Pipeline nutzt Templates) | aktuell | keep | Beschreibt Pipeline, nicht Templates direkt |
| `../../contracts/detail-view-type-checklist.md` | indirekt (Detail-View-Type aus Template) | aktuell | keep | UI-Checkliste |
| `../../contracts/no-silent-fallbacks.md` | global | aktuell | keep | gilt fuer 5 catch{} in template-service.ts |
| `../../contracts/storage-abstraction.md` | global | aktuell | keep | template-service-client.ts darf nicht direkt fs nutzen |
| `../../contracts/templates-contracts.md` (NEU) | direkt | wird in Schritt 2 erstellt | create | Modul-Invarianten |

## B. Tests

| Test-Datei | Testet | Code existiert? | Aktion |
|---|---|---|---|
| `tests/unit/templates/builtin-creation-templates.test.ts` | `builtin-creation-templates.ts` | ja | keep |
| `tests/unit/templates/creation-image-fields.test.ts` | image-field-Logik in `template-frontmatter-utils.ts` | ja | keep |
| `tests/unit/templates/image-field-keys.test.ts` | image-field-keys | ja | keep |
| `tests/unit/templates/library-creation-config-builtin.test.ts` | `library-creation-config.ts` Built-in-Pfad | ja | keep |
| `tests/unit/templates/pdfanalyse-commoning-template-parsing.test.ts` | `template-parser.ts` Spezialfall | ja | keep |
| `tests/unit/templates/template-options.test.ts` | `template-options.ts` | ja | keep |

## C. Docs

| Doc-Datei | Beschreibt was | Status | Aktion |
|---|---|---|---|
| `docs/architecture/template-system.md` | Template-System Architektur | aktuell | keep |
| `docs/architecture/use-cases-and-personas.md` | erwaehnt Templates am Rande | aktuell | keep |
| `docs/architecture/secretary-format-interfaces.md` | Format-Interface | aktuell | keep |
| `docs/refactor/templates/*` (NEU) | Welle-Doku | wird erstellt | create |

## Zusammenfassung

| Kategorie | keep | update | migrate | delete | create |
|---|---:|---:|---:|---:|---:|
| Rules | 5 | 0 | 0 | 0 | 1 |
| Tests | 6 | 0 | 0 | 0 | 0 |
| Docs | 3+ | 0 | 0 | 0 | mehrere (Welle-Doku) |

Keine Tests/Rules zu loeschen oder zu migrieren. Hauptarbeit: neue
Char-Tests + neue Modul-Rule.
