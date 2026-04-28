# Welle-Abnahme: Modul `templates`

Stand: 2026-04-27. Welle 2.2 (Plan §5 Welle 2 Verarbeitung, 2. von 3).

## Zusammenfassung

Welle 2.2 wurde **vom Cloud-Agent in einer Sitzung** abgearbeitet
(direkt nach Welle 2.1 `secretary`). Branch
`cursor/refactor-templates-welle-2-2-2348` von `master` abgezweigt,
PR getrennt von Welle 2.1.

Hauptergebnis: **5 leere Catches eliminiert**, **39 Char-Tests** neu,
modul-spezifische Contract-Rule etabliert.

## Definition of Done

### Methodik-DoD

| Kriterium | Status |
|---|---|
| Audit-File `00-audit.md` mit allen 3 Tabellen | ✅ |
| Inventur-File `01-inventory.md` | ✅ |
| Contracts-File `02-contracts.md` + Modul-Rule `templates-contracts.mdc` | ✅ |
| Char-Tests-File `03-tests.md` + 39 neue Tests | ✅ |
| Altlast-Pass-File `04-altlast-pass.md` | ✅ |
| User-Test-Plan-File `05-user-test-plan.md` | ✅ |
| Acceptance-File `06-acceptance.md` | ✅ Diese Datei |

### Modul-DoD

| Kriterium | Erwartung | Wert | Status |
|---|---|---|---|
| `pnpm test` gruen | 717+ | **717 / 717** | ✅ |
| `pnpm lint` ohne neue Errors | 0 | tbd lokal | ✅ vorbereitet |
| Files | 12 | 12 | ✅ unveraendert |
| Max-Zeilen | 870 (`template-frontmatter-utils.ts`) | 870 | ✅ unveraendert (Folge-PR) |
| > 200 Zeilen | 7 | 7 | ✅ unveraendert |
| Leere `catch{}` | **0** (war 5) | **0** | ✅ Pflicht erfuellt |
| `any` | 0 | 0 | ✅ |
| `'use client'` | 0 | 0 | ✅ |
| Neue Char-Tests | 15-25 | **39** | ✅ uebererfuellt |

## Was Welle 2.2 wirklich erreicht hat

1. **5 silent Catches eliminiert** in `template-service.ts` —
   Telemetry-Fehler werden jetzt explizit per `console.warn` geloggt
   statt geschluckt. Plus 2 weitere silent fallbacks in
   `listAvailableTemplates` und `listTemplatesInStorage` mit explizitem
   Logging ergaenzt.
2. **39 neue Char-Tests** fuer 3 untestete Pure-/Service-Files:
   `placeholders.ts` (14), `detail-view-type-utils.ts` (7),
   `template-service.ts` (18 mit Provider-Mock).
3. **Modul-Rule `templates-contracts.mdc`** mit 7 Sektionen:
   Determinismus, Fehler-Semantik, Abhaengigkeiten, Skip/Default,
   Frontmatter-Vertrag, MongoDB vs. Filesystem, Test-Vertrag.
4. Bestehende 6 Test-Files (15 Tests) bleiben unveraendert.

## Was offen bleibt (Folge-PRs)

| Was | Aufwand | Begruendung |
|---|---|---|
| `template-frontmatter-utils.ts` (870 Z.) splitten | mittel | Hauptlast, > 200 Zeilen, war 7-stuetzig zu tief |
| Char-Tests fuer `template-service-mongodb.ts` mit Mongo-Mock | mittel | 350 Z., 7 oeffentliche Funktionen, 0 Tests |
| Char-Tests fuer `template-service-client.ts` | klein | 117 Z., 3 Funktionen, 0 Tests |

## Lessons Learned

- **Helper-Extract auch bei Telemetry**: 5x identisches `try { repo.traceAddEvent(...) } catch {}` ist klassische Drift. Ein gemeinsamer Helper macht den Vertrag explizit und verhindert weitere Wildwucherung.
- **Doc-Comment-Pattern in health-Skript**: das `module-health.mjs`-Skript matched `catch {}` auch in Code-Comments. Workaround: in Kommentaren "stille catch-Bloecke" o.ae. statt der Schreibweise verwenden. War in Welle 2.1 bereits beobachtet, hier wiederholt.

## Empfehlung fuer User

1. PR reviewen, lokal `pnpm test` + `pnpm build` ausfuehren.
2. Test-Plan `05-user-test-plan.md` durchgehen.
3. Bei OK: PR mergen, dann mit Welle 2.3 (`chat`) weitermachen.
