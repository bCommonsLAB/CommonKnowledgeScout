# User-Test-Plan: Welle 1 — Modul `storage`

Stand: 2026-04-26. Erstellt fuer User-Verifikation NACH dem Cloud-Agent-Lauf.
Bezug: [`06-acceptance.md`](./06-acceptance.md), Playbook R3, Pilot-Vorbild
[`docs/refactor/external-jobs/05-user-test-plan.md`](../external-jobs/05-user-test-plan.md).

## Ziel

Bevor Welle 1 nach `master` gemerged wird, soll der User lokal verifizieren,
dass die Code-Aenderungen funktional unauffaellig sind. Die Welle hat
ausschliesslich am Storage-Modul gearbeitet — Tests in der App muessen
Storage-bezogene UseCases (Library wechseln, Datei oeffnen/laden) abdecken.

## Was wurde im Code geaendert

| # | Aenderung | Datei | Test-Risiko |
|---|---|---|---|
| 1 | Helper-Extraktion: `extractGraphEndpoint` und `parseRetryAfter` aus `onedrive-provider.ts` nach `onedrive/errors.ts` (reine Funktion, identische Logik) | `src/lib/storage/onedrive-provider.ts` (-30 Z.), `src/lib/storage/onedrive/errors.ts` (+51 Z.) | sehr gering — pure Funktionen, char-test-gruen |
| 2 | Silent-Catch in `getPathItemsById` dokumentiert + Logging via `FileLogger.warn` | `src/lib/storage/onedrive-provider.ts:2092` | gering — bei OneDrive-Pfad-Aufbau ohne Lese-Berechtigung erscheint jetzt ein Log statt `silent`. Das beobachtbare UI-Verhalten (kuerzere Breadcrumb) ist identisch. |
| 3 | OAuth-Server-Helper umgezogen: `onedrive-provider-server.ts` -> `onedrive/oauth-server.ts`. Aufrufer-Import angepasst. Klassenname unveraendert. | `src/lib/storage/onedrive/oauth-server.ts`, `src/app/api/auth/onedrive/callback/route.ts:5` | gering — nur Pfad-Aenderung, Verhalten identisch. **OneDrive-OAuth-Flow muss getestet werden** (Add Library, dann erneut authenticate). |
| 4 | Neuer storage-agnostischer Helper `isFilesystemBacked()` in `library-capability.ts` | `src/lib/storage/library-capability.ts` | gering — pure Funktion, char-test-gruen |
| 5 | Pilot-Migration in `file-preview.tsx`: nutzt jetzt `isFilesystemBacked()` statt direktem `primaryStore`/`persistToFilesystem`-Check | `src/components/library/file-preview.tsx:1131-1133` | gering — beobachtbares Verhalten identisch. **Sammeltranskript-Markdown muss in Filesystem- UND Mongo-Library getestet werden**, weil die neue Helper-Funktion an dieser Stelle die Mongo-Transkript-Link-Anzeige steuert. |

**Was NICHT geaendert wurde (Folge-PRs):**

- Vollstaendiger Split von `onedrive-provider.ts` (2.104 Z.) in 5 Sub-Module
  (`auth.ts`, `items.ts`, `binary.ts`, `cache.ts`) — invasive Bewegung,
  Folge-PR mit eigenen Char-Tests fuer Auth-Flow.
- `storage-factory.ts` (801 Z.) splitten — sekundaer.
- Alle `library.type ===`-Branches im Codebase aufraeumen — gehoert in
  Welle 9d (`file-preview`).

---

## Phase A — Automatisierte Tests (5 Min)

Im Projekt-Root:

```powershell
pnpm install
pnpm test
```

**Erwartung:**
- 490/490 Tests gruen (vorher 451, +39 neue Tests in Welle 1)
- Keine neuen Fehler

```powershell
pnpm lint 2>&1 | Select-String -Pattern "error" | Measure-Object | Select-Object -ExpandProperty Count
```

**Erwartung:** 0 neue Errors. Bestehende Warnings (191 insgesamt aus Pilot-
Welle, davon 75 in `external-jobs/`) sind erwartet — Welle 1 raeumt sie
nicht auf.

```powershell
pnpm health -- --module storage
```

**Erwartung:**
- Files: 16 (vorher 15)
- Max-Zeilen: 2.104 (vorher 2.109)
- > 200 Zeilen: 9 (unveraendert — voller OneDrive-Split ist Folge-PR)
- **Leere Catches: 0** (vorher 1) ← Modul-DoD-Ziel erfuellt

---

## Phase B — Build-Sanity-Check (3 Min)

Damit fehlende Imports oder TypeScript-Fehler nicht erst im Production-Build
auffliegen:

```powershell
pnpm build
```

**Erwartung:** Build laeuft durch, keine TypeScript-Fehler, kein
"Module not found" auf den umgezogenen `onedrive-provider-server.ts`-Pfad.

**Bei Fehlern:** Im Output nach Imports der alten Pfade suchen:

```powershell
Select-String -Path src,tests,electron -Pattern "onedrive-provider-server" -Recurse 2>&1
```

Sollte nichts liefern (alle Aufrufer wurden migriert).

---

## Phase C — Lokale UI-Smoke-Tests (15-30 Min, je nach Provider-Auswahl)

App lokal starten:

```powershell
pnpm dev
```

Im Browser: `http://localhost:3000`

Voraussetzungen:
- Mindestens **eine** Library pro Provider-Typ konfiguriert (Filesystem,
  OneDrive, Nextcloud) — falls nur 1-2 verfuegbar, andere Phase-C-Tests
  als "nicht testbar" markieren.
- MongoDB erreichbar.

### Empfohlene Test-Reihenfolge (Risiko-priorisiert)

| # | Provider | Szenario | Warum dieser Test? | Kategorie |
|---|---|---|---|---|
| 1 | Filesystem | Library wechseln, Ordner oeffnen, Markdown-Datei oeffnen | Trifft `isFilesystemBacked()`-Migration in `file-preview.tsx` (Sammel-Transkript-Pfad). Smoke fuer LocalStorageProvider. | **MUSS gruen** |
| 2 | OneDrive | Library wechseln, Ordner oeffnen, PDF-Datei oeffnen | Smoke fuer OneDriveProvider (`listItemsById`, `getBinary`). Stresst extrahierte Helper (`extractGraphEndpoint`, `parseRetryAfter` indirekt bei 429). | **MUSS gruen** |
| 3 | OneDrive | Library neu hinzufuegen ODER vorhandene OneDrive-Library re-authentifizieren | **Test fuer Schritt-4b-Move**: OAuth-Callback-Route nutzt jetzt `onedrive/oauth-server.ts`. Wenn der Import bricht, scheitert Authentifizierung sofort. | **MUSS gruen** |
| 4 | Nextcloud | Library wechseln, Ordner oeffnen, Datei oeffnen | Smoke fuer NextcloudClientProvider (Welle 1 hat ihn nicht angefasst, aber `getProvider()`-Char-Tests fixieren die Auswahl) | **MUSS gruen, falls Library verfuegbar** |
| 5 | Filesystem | Datei hochladen, dann loeschen | Stresst `LocalStorageProvider.uploadFile` und `deleteItem` (Welle 1 hat sie nicht geaendert; Smoke-Test) | sollte gruen |
| 6 | OneDrive | Sammel-Transkript (composite-transcript) oeffnen — Mongo-Transkript-Link sollte angezeigt werden | **Test fuer Schritt-4c-Migration**: `isFilesystemBacked()` steuert `injectMongoTranscriptLinks`. OneDrive ist Mongo-only -> Link wird angezeigt. | sollte gruen |
| 7 | Filesystem | Sammel-Transkript (composite-transcript) oeffnen — Mongo-Transkript-Link sollte NICHT angezeigt werden | **Test fuer Schritt-4c-Migration**: Filesystem -> `injectMongoTranscriptLinks=false`. | sollte gruen |
| 8 | OneDrive | Pfad mit > 5 Ebenen tief navigieren ohne Lese-Berechtigung auf Zwischenebene | Triggert geloggten Eltern-Item-Fehler aus Schritt 4a (`FileLogger.warn` statt silent). Im Log sollte eine Warnung erscheinen. | nice-to-have, nur falls reproduzierbar |

**Minimales Smoke-Set** (10 Min, wenn Zeit knapp): 1 + 2 + 3.

**Vollstaendiges Set** (30 Min): alle 1-8 bei Verfuegbarkeit der Libraries.

### Was bei Failure beobachten

- **Auth-Failure** (Test #3) → ist der neue Pfad `@/lib/storage/onedrive/oauth-server`
  korrekt aufloesbar? `pnpm build`-Output pruefen.
- **Listing-Fehler** (Test #1, #2, #4) → ist der Provider-Auswahl-Switch in
  `getProvider()` betroffen? Char-Test
  `storage-factory-provider-selection.test.ts` lokal laufen.
- **Sammel-Transkript-Anzeige falsch** (Test #6, #7) → ist
  `isFilesystemBacked()` korrekt? Char-Test
  `library-capability.test.ts` lokal laufen.

Ergebnis dokumentieren:

```markdown
## Test-Lauf am <Datum>

| Test | Provider | Status | Befund |
|---|---|---|---|
| 1 Folder + Markdown | Filesystem | OK | Datei laedt, Markdown rendert |
| 2 Folder + PDF | OneDrive | OK | Datei laedt |
| 3 Re-Auth | OneDrive | OK | Tokens werden gespeichert |
| ... | ... | ... | ... |
```

---

## Phase D — Befund konsolidieren

Nach Phase A-C: User entscheidet eine von drei Optionen.

### Option 1: Alles gruen → Welle 1 ist abgenommen

- Acceptance-Bericht (`06-acceptance.md`) bleibt wie ist.
- Naechste Welle (`shadow-twin` o.ae., siehe Plan §5 Welle 2) kann starten.
- Nachsorge-PRs fuer storage (voller OneDrive-Split, `storage-factory.ts`-Split,
  Tests fuer Filesystem-/Nextcloud-Provider) in den Backlog.

### Option 2: Failures, aber bekannt (z.B. OneDrive-Library nicht da, Nextcloud nicht konfiguriert)

- Befund in `05-user-test-plan.md` ergaenzen ("nicht testbar mangels X")
- Welle als "best effort verifiziert" markieren
- Naechste Welle starten

### Option 3: Echte Regression

- Konkreter Test + Stack-Trace in eine Mini-Welle "Welle 1 Hotfix" packen
- 1 Agent macht den Fix
- Lokal testen
- Push erst nach OK

---

## Was wir ueber das Modul lernen wollen (Erkenntnis-Ziele)

Welle 1 ist die **erste seriell-aufgesetzte** Welle nach Pilot
(R2 default = 1 Cloud-Agent, kein Parallelismus). Wir wollen ableiten:

1. **Reicht 1 Cloud-Agent fuer eine Welle?** (Pilot hatte 5 parallel — Daten
   fuer R2-Bestaetigung)
2. **Sind die Char-Tests genug Sicherheitsnetz?** (23 Tests fuer
   `onedrive-provider.ts`-Hauptmethoden — laesst sich Folge-Split sicher
   bauen?)
3. **Helper-Migration `isFilesystemBacked` als Vorbild fuer Welle 9d?**
   (eine Stelle migriert; wenn 8.+ Stellen aehnlich aussehen, ist das die
   Strategie)
