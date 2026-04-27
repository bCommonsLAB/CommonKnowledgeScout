# Altlast-Pass: Modul `secretary`

Stand: 2026-04-27. Welle 2.1, Schritt 4.

## Erledigte Punkte

### 1. Silent Catch in `client.ts:731` eliminiert ✅

`} catch {}` im OneDrive-Token-Sync-Block wurde komplett ersetzt durch
einen extrahierten Helper `syncOneDriveTokensToServer` mit
**explizitem** Logging und Begruendungs-Kommentar.

| Vorher | Nachher |
|---|---|
| `client.ts:731` `} catch {}` (kommentarlos schluckt JEDEN Fehler) | `client-helpers.ts` `syncOneDriveTokensToServer` mit `console.warn` + Doc-Kommentar warum best-effort |

Bezug: [`secretary-contracts.mdc`](../../../.cursor/rules/secretary-contracts.mdc) §2 + §4.

### 2. Helper-Extract `client-helpers.ts` ✅

Neue Datei `src/lib/secretary/client-helpers.ts` (174 Zeilen) mit:

| Helper | Zeilen | Pure? | Begruendung |
|---|---:|---|---|
| `OneDriveTokens` Interface | 6 | n/a | Typ-Vertrag fuer localStorage-Eintrag |
| `readOneDriveTokensFromStorage` | 18 | nein (I/O auf localStorage) | Kapselt window-Check + JSON-Parse-Fehlerpfad |
| `writeOneDriveTokensToStorage` | 9 | nein (I/O auf localStorage) | Kapselt window-Check |
| `shouldRefreshOneDriveToken` | 9 | **ja, pure** | Reine Zeit-Berechnung; isoliert testbar |
| `syncOneDriveTokensToServer` | ~75 | nein (I/O auf fetch + localStorage) | Token-Sync-Orchestrierung mit explizitem Logging |

`client.ts` benutzt jetzt nur noch `await syncOneDriveTokensToServer(libraryId)` —
4 Zeilen statt 38 Zeilen Inline-Code.

### 3. Cross-Modul-Test verschoben ✅

`tests/unit/secretary/process-video-job-defaults.test.ts` →
`tests/unit/api/secretary/process-video-job-defaults.test.ts`.

Begruendung: Test prueft API-Route (`src/app/api/secretary/process-video/job/route.ts`),
nicht `src/lib/secretary/`-Code. Verankert in
[`secretary-contracts.mdc`](../../../.cursor/rules/secretary-contracts.mdc) §7.

### 4. Char-Tests fuer Helper hinzugefuegt ✅

`tests/unit/secretary/client-helpers.test.ts` mit **18 Tests** in
4 describe-Bloecken:

- `shouldRefreshOneDriveToken` — 5 Tests (pure Funktion, alle Zeitfaelle)
- `readOneDriveTokensFromStorage` — 4 Tests (Server-Pfad, leer, gueltig, kaputt)
- `writeOneDriveTokensToStorage` — 2 Tests (Browser, Server-no-op)
- `syncOneDriveTokensToServer` — 7 Tests (no-op ohne Token, persist ohne Refresh, refresh+persist, Refresh-Fehler-Pfad, Persist-Fehler-Pfad, network-Fehler-Pfad)

## Health-Stats: Vorher / Nachher

| Kennzahl | Vorher | Nachher | DoD-Ziel | Status |
|---|---:|---:|---:|---|
| Files | 7 | 8 | 7-10 | ✅ |
| Max-Zeilen | 1.222 (`client.ts`) | 1.192 (`client.ts`) | < 800 (Pflicht) | 🟡 Pflicht **NICHT** erreicht — siehe unten |
| > 200 Zeilen | 3 | 3 | 2-3 | ✅ |
| Leere `catch{}` | 1 | **0** | 0 | ✅ |
| `any` | 0 | 0 | 0 | ✅ |
| `'use client'` | 0 | 0 | 0 | ✅ |

## DoD-Diskrepanz: `client.ts` ueber 800 Zeilen — bewusste Entscheidung

Der AGENT-BRIEF (E2 + E7) hatte als Pflicht-Ziel `client.ts < 800 Zeilen`
genannt. **Das ist nicht erreicht** (1.192 Zeilen).

**Begruendung fuer bewussten Verzicht** (Stop-Bedingung "1.000 Zeilen
Diff" und R5 "lieber kleine erreichte Ziele als grosse unerfuellte"):

- `client.ts` enthaelt 13 oeffentliche Funktionen, jede 50-150 Zeilen mit
  eigenem FormData-Aufbau, eigenem Logging-Pattern, eigenem Response-
  Parser. Eine echte Reduktion unter 800 Zeilen wuerde voraussetzen,
  die Funktionen nach Endpunkt-Typ (audio.ts / pdf.ts / video.ts /
  image.ts / session.ts) zu splitten — das ist der **explizit als
  Folge-PR markierte** Schritt aus AGENT-BRIEF E2.
- Der Helper-Extract `client-helpers.ts` ist der einzige sauber
  isolierbare pure-ish Bereich im Modul. Weitere Extracts (z.B.
  pro-Funktion-FormData-Builder) waeren rein syntaktisch und brachten
  keinen Test-/Verstaendnis-Gewinn.
- Die wirklichen Verbesserungen dieser Welle (Char-Tests + Catch-Fix)
  sind unabhaengig von der Zeilen-Zahl wertvoll.

**Stretch-Ziel `< 600 Z.`** ist ohne vollen Endpunkt-Split nicht
erreichbar und bleibt fuer Folge-PR.

**Folge-PR-Empfehlung** (in `06-acceptance.md` festgehalten):

| Schritt | Erwartung | Reihenfolge |
|---|---|---|
| `client.ts` nach Endpunkt-Typen splitten (audio/pdf/video/image/session/track/text/rag) | client.ts wird zur Re-Export-Fassade unter ~50 Zeilen, neue Sub-Files je 100-200 Zeilen | nach Welle 2.3 (chat) wenn Cross-Modul-Bezuege ausstehen |
| Adapter-Schicht zusammenlegen oder klarer abgrenzen | client vs. adapter Vertrag | nach Welle 3 UX |

## NICHT erledigte Watchpoints (mit Begruendung)

1. **`localStorage`-Direktzugriff in Helpers** (`client-helpers.ts`) —
   bleibt drin, weil das Verhalten 1:1 dem Vorher-Code entspricht und
   Aufrufer-Migration noetig waere (Welle 3-Watchpoint).
2. **UI-Komponenten importieren `secretary` direkt** —
   `src/components/event-monitor/`, `creation-wizard/`,
   `library/file-preview.tsx`. Audit Status `keep` mit Watchpoint:
   gehoert in Welle 3 UX-Refactor.
3. **Adapter vs. Client Layer-Trennung** (AGENT-BRIEF E3) — Audit hat
   keine konkrete Drift gefunden; Layer-Trennung bleibt. Folge-PR
   nur wenn neue Drift entsteht.
4. **Streaming-Pfade**: derzeit nicht aktiv im Standard-Code — kein
   Char-Test noetig. Wenn Streaming reaktiviert wird: Char-Tests
   verlangen.
