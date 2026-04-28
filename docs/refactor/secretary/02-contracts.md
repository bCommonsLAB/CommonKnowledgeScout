# Contracts: Modul `secretary`

Stand: 2026-04-27. Welle 2.1, Schritt 2.

## Output

Neue Modul-Rule: [`.cursor/rules/secretary-contracts.mdc`](../../../.cursor/rules/secretary-contracts.mdc).

`alwaysApply: false`, Globs: `src/lib/secretary/**/*.ts` und
`tests/unit/secretary/**/*.ts`. Damit greift die Rule in beiden
Verzeichnissen — analog zu `shadow-twin-contracts.mdc` und
`ingestion-contracts.mdc`.

## Sektionen-Uebersicht

| § | Thema | Kernregel |
|---|---|---|
| §1 | Determinismus | Pure Helper sind seiteneffekt-frei. `client.ts` und `adapter.ts` sind I/O, NICHT pure |
| §2 | Fehler-Semantik | Kein silent fallback; `SecretaryServiceError` als kanonische Klasse; `fetchWithTimeout` Pflicht; `catch {}` verboten |
| §3 | Abhaengigkeiten | DARF: `utils/fetch-with-timeout`, `env`, `templates/template-service`, `logging`. DARF NICHT: `components/**`, `app/**`, `storage/**`, `shadow-twin/**`, `external-jobs/**` |
| §4 | Skip-/Default | Default-Werte (z.B. `extractionMethod = 'docling'`) explizit; fehlende Konfig wirft, kein Fallback auf leere URL |
| §5 | Streaming | `Response.body.getReader()` statt `.json()`; `onProgress`-Callback; saubere Fehler-Abbrueche |
| §6 | Externer Service | Tabu — Wrapper aendert nie externen Service-Vertrag; `localStorage`-Zugriff ist Drift-Watchpoint |
| §7 | Test-Vertrag | `fetchWithTimeout` und `getSecretaryConfig` Mock-Pflicht; API-Route-Tests gehoeren nach `tests/unit/api/secretary/` |

## Audit-Findings, die in dieser Rule verankert wurden

- **§2** verankert den Pflicht-Fix fuer `client.ts:731` (`catch {}`).
- **§3** verankert den UI-Watchpoint (Welle 3): `secretary` darf
  langfristig nicht aus UI-Komponenten direkt importiert werden.
- **§6** verankert `localStorage`-Drift als bewussten Watchpoint, nicht
  als sofortigen Fix (Aufrufer-Migration noetig).
- **§7** verankert die Test-Trennung: API-Route-Tests gehoeren NICHT
  nach `tests/unit/secretary/`. Audit-Status `migrate` fuer
  `process-video-job-defaults.test.ts` wird in Schritt 4 umgesetzt.

## Beziehung zu globalen Rules

Diese Rule **ergaenzt**, ueberschreibt nicht:

- [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc)
  → diese Rule konkretisiert §2.
- [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc)
  → diese Rule konkretisiert §3 (Abhaengigkeiten).
- [`contracts-story-pipeline.mdc`](../../../.cursor/rules/contracts-story-pipeline.mdc)
  → globale Pipeline-Vertraege bleiben gueltig; diese Rule fuegt
  Wrapper-spezifische Verfeinerungen hinzu.
- [`shadow-twin-contracts.mdc`](../../../.cursor/rules/shadow-twin-contracts.mdc)
  Z. 75 erwaehnt `secretary/response-parser` → bleibt unveraendert.
- [`external-jobs-integration-tests.mdc`](../../../.cursor/rules/external-jobs-integration-tests.mdc)
  Z. 59-69 beschreibt den externen Service → bleibt unveraendert.
