# User-Test-Plan: Welle 2.1 — Modul `secretary`

Stand: 2026-04-27. Erstellt fuer User-Verifikation NACH dem Welle-Lauf.
Bezug: [`06-acceptance.md`](./06-acceptance.md), Playbook R3,
Vorbild [`docs/refactor/ingestion/05-user-test-plan.md`](../ingestion/05-user-test-plan.md).

## Ziel

Bevor Welle 2.1 nach `master` gemerged wird, soll der User lokal
verifizieren, dass die Code-Aenderungen funktional unauffaellig sind.
Welle 2.1 hat im `secretary`-Modul:

- Eine pure Helper-Datei `client-helpers.ts` extrahiert
- Den Token-Sync-Pfad in `client.ts:transformPdf` durch Helper-Aufruf ersetzt
- Den frueher silent gefangenen Fehler durch Logging + Kommentar ersetzt
- 60 neue Char-Tests hinzugefuegt
- 1 Test-File nach `tests/unit/api/secretary/` verschoben

## Was wurde im Code geaendert

| # | Aenderung | Datei | Test-Risiko |
|---|---|---|---|
| 1 | OneDrive-Token-Sync aus `transformPdf` extrahiert in neuen Helper `syncOneDriveTokensToServer`. Aufrufer-Stelle in `client.ts` ersetzt 38 Zeilen Inline-Code durch 1 Funktionsaufruf. Logik **unveraendert**, aber jetzt mit explizitem Logging im Fehler-Pfad statt `catch {}`. | `src/lib/secretary/client-helpers.ts` (neu, +174 Z.), `src/lib/secretary/client.ts` (-38/+5 Z.) | gering — char-test-gruen mit 18 Helper-Tests |
| 2 | 4 neue Char-Test-Files (42 Tests) fuer `secretary`: `adapter.test.ts`, `client-pdf-image.test.ts`, `client-audio-video-text.test.ts`, `client-session-rag.test.ts`. Bestehende Tests bleiben unveraendert. | `tests/unit/secretary/` | keine — nur Tests |
| 3 | API-Route-Test verschoben | `tests/unit/api/secretary/process-video-job-defaults.test.ts` (neu, 100% Rename von `tests/unit/secretary/`) | keine — Test wurde verschoben, Inhalt unveraendert |
| 4 | Neue Cursor-Rule `.cursor/rules/secretary-contracts.mdc` (7 Sektionen) | `.cursor/rules/` | keine — nur Regelwerk |
| 5 | Welle-Doku unter `docs/refactor/secretary/` (8 Files) | `docs/refactor/secretary/` | keine — nur Doku |

**Was NICHT geaendert wurde (Folge-PRs):**

- Vollstaendiger Split von `client.ts` (1.192 Z.) nach Endpunkt-Typ
  (audio/pdf/video/image/session/track/text/rag) — Folge-PR.
- Adapter-Schicht `adapter.ts` (440 Z.) bleibt unveraendert.
- UI-Komponenten, die direkt aus `secretary/` importieren — Welle 3.
- `localStorage`-Direktzugriff im Helper bleibt erhalten — Welle 3.

---

## Phase A — Automatisierte Tests (5 Min)

Im Projekt-Root:

```powershell
pnpm install
pnpm test
```

**Erwartung:**

- **737 / 737 Tests gruen** (vorher 594, +143 inkl. PR #294 + Welle 2.1)
- Keine neuen Fehler

```powershell
pnpm lint
```

**Erwartung:** keine neuen Errors. (Bestands-Warnings duerfen bleiben.)

```powershell
node scripts/module-health.mjs --module secretary
```

**Erwartung:**

```
| `secretary` | 8 | 1192 (src/lib/secretary/client.ts) | 3 | ja | 0 | 0 | 0 |
```

→ 0 leere Catches (war 1), Files +1, Max-Zeilen leicht reduziert.

## Phase B — Build-Smoke (2 Min)

```powershell
pnpm build
```

**Erwartung:** Build laeuft durch. Kein Broken-Import auf
`@/lib/secretary/client-helpers`.

## Phase C — UI-Smoke (10 Min)

Starte den Dev-Server und teste die wichtigsten Use-Cases, die
`secretary` indirekt nutzen:

```powershell
pnpm dev
```

### Test 1 — PDF-Transform mit OneDrive-Library

1. Login als User mit OneDrive-Library
2. Lade eine PDF in eine OneDrive-Library hoch
3. Triggere "Transformieren" auf der PDF
4. **Erwartung**: Transform laeuft an wie zuvor. In der Browser-Console
   sollte _kein_ neuer Fehler stehen. Wenn der Token-Refresh aktiv
   wird, sieht man jetzt ggf. eine `console.warn` mit Praefix
   `[secretary/client-helpers]` — das ist neu und gewollt.

### Test 2 — PDF-Transform mit nicht-OneDrive-Library

1. Login als User mit lokaler oder Nextcloud-Library
2. Triggere "Transformieren" auf einer PDF
3. **Erwartung**: Token-Sync ist no-op (kein localStorage-Eintrag).
   Transform startet wie zuvor.

### Test 3 — Image-Processing (PR #294 — composite-multi)

1. Lade ein Bild in eine Library hoch
2. Triggere "Composite Multi-Image" wenn vorhanden
3. **Erwartung**: image-analyzer-multi-Pfad funktioniert weiterhin
   (Bestands-Test gruen).

### Test 4 — Audio/Video-Transform

1. Lade eine Audio- oder Video-Datei hoch
2. Triggere "Transformieren"
3. **Erwartung**: Transform laeuft. `transformAudio` und
   `transformVideo` waren in dieser Welle nur durch Char-Tests
   abgedeckt — kein Code-Diff im Produktivpfad.

## Phase D — Stichprobe Logging (3 Min)

OPTIONAL: Wenn der User OneDrive-Tokens manuell ungueltig macht (z.B.
expiry: 0 im DevTools-localStorage), sollte beim PDF-Transform jetzt
sichtbar werden:

- `[secretary/client-helpers] OneDrive-Refresh fehlgeschlagen: ...`
  oder `[secretary/client-helpers] OneDrive-Token-Persist fehlgeschlagen: ...`

Vorher war das ein **stiller** Fehler. Jetzt ist das Verhalten
sichtbar — das ist der Hauptgewinn der Welle.

---

## Erwartetes Resultat

| Phase | Ergebnis | Bei Abweichung |
|---|---|---|
| A — Tests | 737/737 gruen | Logs sammeln, in PR-Kommentar dokumentieren |
| A — Lint | 0 neue Errors | dito |
| A — Health | 0 leere Catches, 0 any | dito |
| B — Build | erfolgreich | Stop, Cloud-Agent informieren |
| C — UI | alle 4 Tests verhalten sich wie vorher | Stop, Cloud-Agent informieren |
| D — Logging | console.warn mit `[secretary/client-helpers]` sichtbar | Stop nur bei Test 1 + manuell ungueltigem Token |

## User-OK-Workflow

1. Phasen A-D durchlaufen.
2. Bei Erfolg: PR mergen.
3. Bei Abweichung: PR-Kommentar mit Befund + Logs.
