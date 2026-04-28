# Dead-Code-Pass: Modul `secretary`

Stand: 2026-04-27. Welle 2.1, Schritt 6.

## Tool

`pnpm knip` (siehe [`docs/refactor/playbook.md`](../playbook.md) Schritt 6).

## Findings im Welle-Scope (`src/lib/secretary/`)

### Unused Files

**0** unused-Files in `src/lib/secretary/`.

### Unused Exports

knip meldet 12 nicht extern genutzte Exporte im Modul:

| Export | Datei | Aktion | Begruendung |
|---|---|---|---|
| `PdfProcessParams` | `adapter.ts:34` | **keep** | Param-Interface fuer `callPdfProcess`; Type-Surface fuer Aufrufer-Typsicherheit |
| `TemplateTransformParams` | `adapter.ts:54` | **keep** | Param-Interface fuer `callTemplateTransform` |
| `TextTranslateParams` | `adapter.ts:161` | **keep** | Param-Interface fuer `callTextTranslate` |
| `TransformerChatParams` | `adapter.ts:231` | **keep** | Param-Interface fuer `callTransformerChat` |
| `TemplateExtractFromUrlParams` | `adapter.ts:358` | **keep** | Param-Interface fuer `callTemplateExtractFromUrl` |
| `OneDriveTokens` | `client-helpers.ts:17` | **keep** | Doc-Vertrag fuer localStorage-Eintrag (siehe contracts §6) |
| `SessionImportResponse` | `client.ts:833` | **keep** | Response-DTO fuer `importSessionFromUrl` |
| `ProcessSessionResponse` | `client.ts:1054` | **keep** | Response-DTO fuer `processSession` |
| `ImageAnalyzerFile` | `image-analyzer.ts:20` | **keep** | Param-Interface fuer `callImageAnalyzerTemplate` |
| `ImageAnalyzerTemplateParams` | `image-analyzer.ts:26` | **keep** | Param-Interface fuer `callImageAnalyzerTemplate` |
| `ImageAnalyzerResponse` | `image-analyzer.ts:70` | **keep** | Response-DTO fuer `callImageAnalyzerTemplate` |
| `FrontmatterParseResult` | `response-parser.ts:28` | **keep** | Result-Vertrag fuer `parseSecretaryMarkdownStrict` |

**Begruendung fuer "keep all"**:

1. **Param-/Result-Interfaces** sind Teil des oeffentlichen API-Typ-
   Surfaces. Aufrufer koennen sie via `import type { X } from '...'`
   nutzen — knip kann das nicht messen, weil es nur Wert-Imports
   verfolgt.
2. **Loeschen wuerde** die Typsicherheit fuer Aufrufer einschraenken,
   weil sie sich auf inline-Typ-Inferenz verlassen muessten.
3. Keine echte Drift-Quelle — die Interfaces beschreiben den Vertrag
   einer existierenden, genutzten Funktion.

Dies entspricht der Stop-Bedingung "knip findet > 5 unklare unused-
Files — User-Frage statt eigenmaechtiges Loeschen". Da keine echten
toten Files gefunden wurden und die Type-Exports begruendet sind,
loescht Welle 2.1 **nichts**.

## Findings AUSSERHALB Welle-Scope

knip meldet 61 unused-Files insgesamt im Repo, davon **0 in
`src/lib/secretary/`**. Die uebrigen 61 betreffen andere Module
(`creation-wizard`, `library`, `event-monitor`, etc.) und sind
**nicht Scope** dieser Welle.

Bemerkenswerte Cross-Modul-Findings, die zu kuenftigen Wellen passen
koennten:

| Pfad | Modul | Welle |
|---|---|---|
| `src/lib/chat/facets.ts` | `chat` | Welle 2.3 (folgt direkt) |
| `src/lib/chat/vector-stats.ts` | `chat` | Welle 2.3 |
| `src/lib/chat/common/toc-parser.ts` | `chat` | Welle 2.3 |
| `src/lib/templates/placeholders.ts` | `templates` | Welle 2.2 (folgt direkt) |
| `src/lib/storage/filesystem-client.ts` | `storage` | Welle 1 — moeglicher Watchpoint fuer Folge-PR |
| `src/lib/storage/filesystem-provider.ts` | `storage` | Welle 1 — moeglicher Watchpoint fuer Folge-PR |

Diese Findings werden **in den jeweiligen Modul-Wellen** erneut
gepruefte und entweder behalten oder geloescht.

## Audit-Findings mit Status `delete`/`archive`

Aus `00-audit.md`:

| Kategorie | Status `delete`/`archive` | Aktion |
|---|---|---|
| Rules | 0 | nichts zu tun |
| Tests | 0 (nur 1× `migrate` — bereits in Schritt 4 erledigt) | nichts zu tun |
| Docs | 0 | nichts zu tun |

## Zusammenfassung

Welle 2.1 loescht **nichts**. Sie haerten das Modul durch Tests +
Helper-Extract + Catch-Fix; Dead-Code-Reduktion ist nicht Welle-Treiber.

Folge-PR-Empfehlung: Wenn nach Welle 2.2 (`templates`) und Welle 2.3
(`chat`) Cross-Modul-Aufrufer wegfallen, knip erneut laufen lassen
und ggf. ungenutzte Type-Surfaces loeschen.
