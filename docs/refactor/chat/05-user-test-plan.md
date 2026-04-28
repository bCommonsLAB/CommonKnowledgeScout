# User-Test-Plan: Welle 2.3 — Modul `chat`

Stand: 2026-04-27.

## Was wurde geaendert

| # | Aenderung | Datei | Test-Risiko |
|---|---|---|---|
| 1 | 9 leere `catch {}` ersetzt durch `console.warn` mit Begruendung. 4 davon via Helper `emitIngestTraceEvent` zusammengefuehrt | `src/lib/chat/ingestion-service.ts`, `src/lib/chat/retrievers/chunks.ts` | gering — Vertrags-Verhalten unveraendert |
| 2 | 32 neue Char-Tests fuer pure Helper | `tests/unit/chat/` | keine — nur Tests |
| 3 | Neue Cursor-Rule `chat-contracts.mdc` | `.cursor/rules/` | keine |
| 4 | Welle-Doku unter `docs/refactor/chat/` | `docs/refactor/chat/` | keine |

## Phase A — Automatisierte Tests

```powershell
pnpm install
pnpm test
```

**Erwartung**: 710+ Tests gruen.

```powershell
node scripts/module-health.mjs --module chat
```

**Erwartung**:
- 0 leere Catches (war 9)
- 0 any
- 30 Files, max ~1.474 Z. (leicht groesser als vorher; bewusste Entscheidung), 14 > 200 Z.

## Phase B — Build-Smoke

```powershell
pnpm build
```

**Erwartung**: Build laeuft durch.

## Phase C — UI-Smoke

```powershell
pnpm dev
```

### Test 1 — Chat-Anfrage stellen

1. Library oeffnen, Chat-Modus
2. Frage stellen, die Vector-Search triggert
3. **Erwartung**: Antwort kommt wie zuvor. Falls die Lexical-Boost-
   Berechnung fehlschlaegt (frueher silent), sieht man jetzt
   `console.warn [chat/retriever-chunks]`.

### Test 2 — Pipeline-Ingest mit PDF

1. PDF hochladen → vollstaendige Pipeline (transcribe + transform +
   ingest)
2. **Erwartung**: Ingest laeuft wie zuvor. Falls Trace-Events nicht
   persistiert werden koennen, sieht man jetzt
   `console.warn [chat/ingest] Trace-Event ... konnte nicht persistiert werden`.

### Test 3 — Frontmatter-Validierung

1. Datei mit unvollstaendigem Frontmatter (z.B. summary fehlt) ingestieren
2. **Erwartung**: Ingest laeuft durch (warnt nur), wie zuvor. Bei
   schwerem Validierungs-Fehler sieht man jetzt
   `console.warn [chat/ingest] validateAndSanitizeFrontmatter fehlgeschlagen`.

## Erwartetes Resultat

Welle 2.3 ist ein **niedrig-Risiko-Refactor** — alle Verhaltens-
Charakteristiken bleiben gleich, nur Sichtbarkeit von Trace-/Index-/
Frontmatter-Fehlern wird verbessert.
