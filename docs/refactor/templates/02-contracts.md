# Contracts: Modul `templates`

Stand: 2026-04-27. Welle 2.2, Schritt 2.

## Output

Neue Modul-Rule: [`.cursor/rules/templates-contracts.mdc`](../../../.cursor/rules/templates-contracts.mdc).

`alwaysApply: false`, Globs: `src/lib/templates/**/*.ts` und
`tests/unit/templates/**/*.ts`.

## Sektionen

| § | Thema | Kernregel |
|---|---|---|
| §1 | Determinismus | Pure Funktionen seiteneffekt-frei (parseTemplate, extractCreationFromFrontmatter, ...) |
| §2 | Fehler-Semantik | TemplateNotFoundError statt undefined; Telemetry-`catch{}` verboten |
| §3 | Abhaengigkeiten | DARF: `external-jobs-repository`, `storage`, `mongodb-service`, `logging`. DARF NICHT: `components/**`, `app/**`, `secretary/**`, `external-jobs/**` |
| §4 | Skip-/Default | loadTemplate Default: pdfanalyse → erstes verfuegbares → Throw |
| §5 | Frontmatter-Vertrag | creation-Block NIE an Secretary; `serializeTemplateWithoutCreation` Pflicht |
| §6 | MongoDB vs. Filesystem | MongoDB primaer; Filesystem nur fuer Import + Migration |
| §7 | Test-Vertrag | Pure Funktionen ohne Mocks; Provider/Mongo via `vi.mock` |

## Verbindung zu Audit-Findings

- §2 verankert Pflicht-Fix der 5 leeren Catches in `template-service.ts`
- §3 verankert UI-Aufrufer-Etikette
- §6 verankert die Legacy-Status-Klarheit (war im Code-Comment, nicht in Rule)
