# Dead-Code: Modul `external-jobs` (Pilot)

Stand: 2026-04-23. Erstellt von Cloud-Agent 5 (Pilot-Welle, Plan-Schritt 6).

## Was diese PR entfernt

### 1. Dead-Code-Files in `src/lib/external-jobs/` (knip-Findings)

| Datei | Zeilen | Begruendung |
|---|---:|---|
| `src/lib/external-jobs/callback-body-parser.ts` | 103 | Exportiert `ParsedCallbackBody` und `parseCallbackBody`. Beide werden nirgendwo importiert (verifiziert via `rg`). Wahrscheinlich Ueberbleibsel einer frueheren Refactor-Welle, in der die Callback-Body-Logik direkt in `start/route.ts` integriert wurde. |
| `src/lib/external-jobs/preprocessor-ingest.ts` | 167 | Thin-Wrapper um den `preprocess`-Analyzer mit den Funktionen `findPdfMarkdown`, `analyzeFrontmatter`, `validateFrontmatter`, `decideNeedIngest`. Wird nur in sich selbst referenziert (interne Imports), kein externer Aufrufer. |

Beide Files wurden vor dem Loeschen verifiziert:
- `rg` ueber das gesamte Repo zeigt keine Imports
- knip-Output bestaetigt "Unused files"
- Tests bleiben gruen nach dem Loeschen → kein indirekter Aufruf

### 2. Audit-Aktion `archive` aus `00-audit.md`

| Datei | Aktion | Ergebnis |
|---|---|---|
| `docs/analyse-worker-start-route-hang.md` | archive | Verschoben nach `docs/_analysis/analyse-worker-start-route-hang.md`. Der Unterstrich-Prefix ist im Repo Konvention fuer historische Analyse-Notizen, die nicht mehr aktive Doku sind. |

## Was diese PR NICHT macht

Per Plan-Sektion 8.6 und ADR 0001:

- **NICHT** ueber `event-job/` ausgefuehrt — eigene Domaene, eigene Welle
- **NICHT** alle knip-Findings im Repo behandelt (69 Files insgesamt) — nur die in `external-jobs/`. Andere Module bekommen ihren eigenen Dead-Code-Pass in der jeweiligen Welle.
- **NICHT** die ungenutzten Exports in `external-jobs/auth.ts` (`hasExternalJobHeader`, `isInternalOrExternalJobBypass`, `guardProcessId`) entfernt — diese koennten ggf. fuer kuenftige Auth-Erweiterungen vorgesehen sein. Empfehlung fuer naechste PR: pruefen und ggf. entfernen.

## Tests / Lint / Health

- `pnpm test` → 97 Files, 451 Tests, **gruen** (unveraendert)
- `pnpm lint` → keine neuen Errors
- `pnpm health` → `external-jobs` zeigt 39 Files (vorher 41, -2 fuer geloeschte Dead-Code-Files)
