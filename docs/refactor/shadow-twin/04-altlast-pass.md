# Altlast-Pass: Modul `shadow-twin`

Stand: 2026-04-27. Erstellt vom Cloud-Agent (Welle 2, Plan-Schritt 4).

Bezug:
- Audit: [`00-audit.md`](./00-audit.md) (Hot-Spots)
- Contracts: [`02-contracts.md`](./02-contracts.md), [`shadow-twin-contracts.mdc`](../../../.cursor/rules/shadow-twin-contracts.mdc)
- Char-Tests: [`03-tests.md`](./03-tests.md)
- Welle-1-Vorbild: [`docs/refactor/storage/04-altlast-pass.md`](../storage/04-altlast-pass.md)

## Was wurde gemacht (Pflicht-Subset aus AGENT-BRIEF Schritt 4)

Ein Sub-Commit, gut unter den Stop-Bedingungen (< 1.000 Zeilen Diff, < 200 Zeilen
Aenderung):

| Commit | Was | Diff |
|---|---|---:|
| `shadow-twin(tests+altlast): file-kind.ts extrahiert + 21 Char-Tests` | Pure Helper `getFileKind` und `getMimeTypeFromFileName` aus `shadow-twin-migration-writer.ts` ausgelagert in neue Datei `src/lib/shadow-twin/file-kind.ts` (51 Z.). 15 Char-Tests fuer den Helper, 6 Char-Tests fuer `buildMongoShadowTwinItem`. | +434 / -49 |

## Vor/Nach `pnpm health -- --module shadow-twin`

| Metrik | Vorher | Nachher | Delta |
|---|---:|---:|---:|
| Files | 30 | 31 | +1 (`file-kind.ts`) |
| Max-Zeilen | 915 (`shadow-twin-service.ts`) | 915 | 0 (kein Extract aus dieser Datei in Welle 2) |
| > 200 Zeilen | 12 | 12 | 0 (`shadow-twin-migration-writer.ts` ging von 458 auf ~415, beide noch > 200) |
| `any` | 0 | 0 | 0 |
| **leere Catches** | 0 | 0 | 0 (war schon erfuellt) |
| `'use client'` | 0 | 0 | 0 |

Tests:
- vorher: 490 Tests in 103 Files
- nachher: **511 Tests in 105 Files** (+21 Tests, +2 Files)

## Pflicht-Subset DETAIL

### 4.1 Pure Helper extrahiert: `file-kind.ts`

Vorher (privat in `shadow-twin-migration-writer.ts`):
```ts
function getFileKind(fileName, mimeType) { /* ... */ }
function getMimeType(fileName) { /* path.extname + mimeMap */ }
```

Nachher (`src/lib/shadow-twin/file-kind.ts`):
```ts
export type FileKind = 'markdown' | 'image' | 'audio' | 'video' | 'binary'
export function getFileKind(fileName, mimeType?): FileKind { /* ... */ }
export function getMimeTypeFromFileName(fileName): string | undefined { /* ... */ }
```

Im `migration-writer.ts` wird ein `const getMimeType = getMimeTypeFromFileName`
Alias gesetzt, damit der Diff klein bleibt (Aufrufer-Stelle unveraendert).

**Begruendung**: Helper ist 100% testbar, keine Side-Effects. Die
Original-Funktion `persistShadowTwinFilesToMongo` (248 Z. exportierte
Hauptfunktion) bleibt unangetastet — Char-Tests fuer die Hauptfunktion
braeuchten umfangreiche Mongo-/Azure-/Provider-Mocks und sind Folge-PR.

### 4.2 Silent-Catch-Status

Health zeigt **0 leere Catches** im Modul (war auch vor Welle 2 so). Kein
Handlungsbedarf in Welle 2. Der bestehende Catch in
`shadow-twin-service.ts:836-843` (Thumbnail-Generierung) ist **bewusst**
und mit Kommentar dokumentiert ("Thumbnail-Fehler sind nicht kritisch -
Original-Upload war erfolgreich") — entspricht §2 (Erlaubte gefangene Fehler).

### 4.3 UI/Service-Branches

Audit hat keine direkten `library.config?.shadowTwin?.primaryStore`-Zugriffe
in UI/Hooks identifiziert, die nicht schon ueber `getShadowTwinConfig` oder
`isFilesystemBacked` (Welle 1) laufen. **Kein Handlungsbedarf** in Welle 2.

Folge-Welle 9d (`file-preview`) wird vermutlich noch direkte Zugriffe
finden — ist nicht Welle-2-Pflicht.

### 4.4 Char-Tests fuer pure Funktion ohne Test

`buildMongoShadowTwinItem` (`mongo-shadow-twin-item.ts`, 59 Z.) war exportiert,
aber ungetestet. 6 neue Tests fixieren:
- ID-Konstruktion (Mongo-Shadow-Twin-Format)
- Roundtrip mit `parseMongoShadowTwinId`
- Default-Werte fuer `markdownLength`, `updatedAt`
- Vertrag §1: verschiedene `templateName` → verschiedene IDs

## Char-Test-Status

| Test-File | Status | Anmerkung |
|---|---|---|
| 13 bestehende Tests in `tests/unit/shadow-twin/*.test.ts` | ✅ | Unveraendert (alle keep) |
| 2 Cross-Modul-Tests in `tests/unit/storage/shadow-twin-*.test.ts` | ✅ | Unveraendert |
| `file-kind.test.ts` (15) | ✅ neu | Schritt 4: Helper-Tests |
| `mongo-shadow-twin-item.test.ts` (6) | ✅ neu | Schritt 3: Pure-Funktion-Test |

Voller `pnpm test`-Lauf nach Welle 2: **511/511 gruen**.

## Was bewusst NICHT in dieser Welle ist

| Was | Wieso | Wohin |
|---|---|---|
| `shadow-twin-service.ts` (914 Z.) splitten | Hauptlast, aber komplexe Klassen-State-Verschiebung wie OneDrive-Provider in Welle 1 | Folge-PR mit eigenen Char-Tests fuer Service-Verhalten |
| `analyze-shadow-twin.ts` (465 Z.) splitten + E2E-Tests | Komplexer Mock-Setup (Mongo + Provider) | Folge-PR |
| `shadow-twin-migration-writer.ts` (~415 Z. nach Helper-Extract) splitten | Hauptklasse-Logik bleibt zusammen, Helper sind raus | Folge-PR optional |
| `artifact-client.ts` (422 Z.) HTTP-Vertraege testen | Welle-1-OneDrive-Pattern uebertragbar, aber Mock-Setup gross | Folge-PR |
| `media-persistence-service.ts` (352 Z.) splitten | Hat Cross-Modul-Effekt zu `media-storage-strategy` | Folge-PR |
| Doku-Aufraeumen `docs/analysis/shadow-twin-*.md` (7 Files archive) | Eigener Move-PR ohne Code | Folge-PR |
| Update `external-jobs-integration-tests.mdc` mit Cross-Reference | Optionaler Komfort | Folge-PR |

## Stop-Bedingungen — was nicht passiert ist

- ✅ Kein Commit > 1.000 Zeilen Diff (groesster: +434 / -49)
- ✅ Tests bleiben gruen nach jedem Commit (511/511)
- ✅ Keine Architektur-Frage offen, die nicht im Brief geklaert ist
- ✅ Keine Live-Mongo-/Azure-Calls in Tests (alle Mocks)

## Folge-Schritte

| Schritt | Was | Wo |
|---|---|---|
| 5 | User-Test-Plan schreiben | `05-user-test-plan.md` |
| 6 | knip durchlaufen, ggf. Dead-Code | direkt |
| 7 | Methodik-DoD + Modul-DoD in `06-acceptance.md` | `06-acceptance.md` |
