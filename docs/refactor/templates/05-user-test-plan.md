# User-Test-Plan: Welle 2.2 — Modul `templates`

Stand: 2026-04-27.

## Was wurde im Code geaendert

| # | Aenderung | Datei | Test-Risiko |
|---|---|---|---|
| 1 | 5 leere `catch {}` in `template-service.ts` ersetzt durch `emitTraceEventSafely`-Helper mit explizitem Logging | `src/lib/templates/template-service.ts` (-30/+30 Z.) | gering — Char-Tests gruen, Vertrags-Verhalten unveraendert |
| 2 | Silent fallback `catch { return [] }` in `template-service.ts` `listAvailableTemplates` durch `console.warn` ergaenzt | dito | sehr gering |
| 3 | dito in `template-import-export.ts` `listTemplatesInStorage` | `src/lib/templates/template-import-export.ts` | sehr gering |
| 4 | 39 neue Char-Tests in 3 Files | `tests/unit/templates/` | keine — nur Tests |
| 5 | Neue Cursor-Rule `templates-contracts.mdc` | `.cursor/rules/` | keine |
| 6 | Welle-Doku unter `docs/refactor/templates/` | `docs/refactor/templates/` | keine |

## Phase A — Automatisierte Tests

```powershell
pnpm install
pnpm test
```

**Erwartung**: 717+ Tests gruen.

```powershell
node scripts/module-health.mjs --module templates
```

**Erwartung**:
- 0 leere Catches (war 5)
- 0 any
- 12 Files, max 870 Z., 7 > 200 Z. (alle unveraendert)

## Phase B — Build-Smoke

```powershell
pnpm build
```

**Erwartung**: Build laeuft durch. Kein Broken-Import.

## Phase C — UI-Smoke

```powershell
pnpm dev
```

### Test 1 — Template-Auswahl im Creation-Wizard

1. Login, Library oeffnen
2. Creation-Wizard starten
3. Template-Liste oeffnen
4. **Erwartung**: Templates werden geladen wie zuvor. Wenn der Storage-
   Templates-Ordner Probleme macht, jetzt `console.warn` mit
   `[templates/service]`-Praefix in DevTools-Console.

### Test 2 — Template-Import

1. Settings → Templates → Import
2. Template aus Storage auswaehlen, importieren
3. **Erwartung**: Import laeuft wie zuvor.

### Test 3 — PDF-Transformation mit Template-Pfad

1. PDF hochladen
2. "Transformieren" mit Template
3. **Erwartung**: Template wird wie zuvor geladen. Falls trace-events
   nicht persistiert werden koennen (z.B. Repo down), sieht man jetzt
   `console.warn` mit `Trace-Event "..." konnte nicht persistiert werden`.

## Erwartetes Resultat

Welle 2.2 ist ein **niedrig-Risiko-Refactor** — alle Verhaltens-
Charakteristiken bleiben gleich, nur die Sichtbarkeit von Telemetry-
und Storage-Fehlern wird verbessert.
