# Altlast-Pass: Modul `storage`

Stand: 2026-04-26. Erstellt vom Cloud-Agent (Welle 1, Plan-Schritt 4).

Bezug:
- Audit: [`00-audit.md`](./00-audit.md) (Hot-Spots)
- Contracts: [`02-contracts.md`](./02-contracts.md), [`storage-contracts.mdc`](../../../.cursor/rules/storage-contracts.mdc)
- Char-Tests: [`03-tests.md`](./03-tests.md)
- Vorbild: [`docs/refactor/external-jobs/02-altlast-pass.md`](../external-jobs/02-altlast-pass.md)

## Was wurde gemacht (Pflicht-Subset aus AGENT-BRIEF Schritt 4)

Drei Sub-Commits, jeweils unter 200 Zeilen Diff, jeder fuer sich
char-test-gruen:

| # | Commit | Was | Diff |
|---|---|---|---:|
| 4a | `storage(altlast): onedrive/errors.ts extrahiert + silent-Catch in getPathItemsById dokumentiert` | Pure Helper `extractGraphEndpoint` und `parseRetryAfter` nach `src/lib/storage/onedrive/errors.ts` ausgelagert. `} catch {}` in `getPathItemsById` (Z. 2092) wird jetzt mit `FileLogger.warn` geloggt + Kommentar erklaert den bewussten Schluck. | 143/30 |
| 4b | `storage(altlast): onedrive-provider-server.ts -> onedrive/oauth-server.ts (kein StorageProvider)` | Datei umgezogen, Header-Doc geschaerft (Klassenname `OneDriveServerProvider` bleibt aus Kompat-Gruenden, Aufrufer in `auth/onedrive/callback/route.ts:5` nachgezogen). | 26/4 |
| 4c | `storage(altlast): isFilesystemBacked() Helper + Pilot-Migration file-preview.tsx:1134` | Neuer storage-agnostischer Helper `src/lib/storage/library-capability.ts`. Pilot-Migration: `file-preview.tsx:1134` benutzt jetzt den Helper statt `primaryStore`/`persistToFilesystem` direkt zu lesen. | 117/4 |

**Gesamter Diff fuer Schritt 4: ca. 286 / 38 Zeilen** — gut unterhalb der
Stop-Bedingung "1.000 Zeilen pro Commit".

## Vor/Nach `pnpm health -- --module storage`

| Metrik | Vorher | Nachher | Delta |
|---|---:|---:|---:|
| Files | 15 | 16 | +1 (`onedrive/errors.ts`, `library-capability.ts`; `onedrive-provider-server.ts` -> `onedrive/oauth-server.ts`) |
| Max-Zeilen | 2.109 (`onedrive-provider.ts`) | 2.104 (`onedrive-provider.ts`) | −5 (Helper extrahiert) |
| > 200 Zeilen | 9 | 9 | 0 |
| `any` | 0 | 0 | 0 |
| **leere Catches** | **1** | **0** | **−1** |
| `'use client'` | 0 | 0 | 0 |

Tests:
- vorher: 451 Tests in 97 Files
- nachher: **490 Tests in 103 Files** (+39 Tests, +6 Files)

## Pflicht-Subset DETAIL

### 4.1 Silent-Catch-Fix in `onedrive-provider.ts:2092` (war 1 Stelle)

Vorher:
```ts
try {
  const parentItem = await this.getItemById(parentId);
  pathItems.push(parentItem);
} catch {}
```

Nachher:
```ts
// Bewusster Schluck: Wenn der Eltern-Lookup fehlschlaegt (z.B. weil der
// User keine Berechtigung mehr fuer einen tieferen Ordner hat), bricht
// das den Pfad-Aufbau nicht ab — die UI zeigt dann nur die kuerzere
// Breadcrumb. Wir loggen den Fehler, statt ihn still zu schlucken.
try {
  const parentItem = await this.getItemById(parentId);
  pathItems.push(parentItem);
} catch (parentErr) {
  FileLogger.warn('OneDriveProvider', 'getPathItemsById: Eltern-Item konnte nicht geladen werden', {
    parentId,
    error: parentErr instanceof Error ? parentErr.message : String(parentErr),
  });
}
```

Der zweite **bewusste** Catch (`} catch {}` im Retry-After-Parse) wurde
ebenfalls dokumentiert (`void jsonErr` mit erklaerendem Kommentar).
`pnpm health` zaehlt jetzt **0** leere Catches im Modul.

### 4.2 OneDrive-Sub-Modul-Skeleton

Geplant in [`storage-contracts.mdc`](../../../.cursor/rules/storage-contracts.mdc) §6
sind 5 Sub-Module (`auth.ts`, `items.ts`, `binary.ts`, `cache.ts`, `errors.ts`).

In dieser Welle umgesetzt:

- ✅ `src/lib/storage/onedrive/errors.ts` — pure Helper, Char-Test-Coverage 10 Tests
- ✅ `src/lib/storage/onedrive/oauth-server.ts` — vorher `onedrive-provider-server.ts`,
  bewusst kein `StorageProvider`-Implementierer
- ⏳ `auth.ts`, `items.ts`, `binary.ts`, `cache.ts` — **Folge-PR**, weil
  ein vollstaendiger Split `OneDriveProvider`-State (Token-Loading, Token-Cache,
  Request-Queue, Pending-Requests-Map, Rate-Limit-Telemetrie) auf 5 Files
  verteilen muesste. Das ist invasive Bewegung mit Risiko fuer parallele
  Token-Refresh-Pfade — gehoert in eigene PR-Serie mit eigenen Char-Tests
  fuer Auth-/Refresh-Flow.

**Begruendung Pragmatismus** (analog Pilot-Welle external-jobs PR #16):
Char-Tests aus Schritt 3 (23 Tests) sichern die OEFFENTLICHE API ab. Der
volle State-Split wird in einer Folge-PR durchgefuehrt; bis dahin bleibt
`onedrive-provider.ts` der Composer (jetzt 2.104 Z. statt 2.109 Z., minus
die extrahierten Helper).

### 4.3 OAuth-Server-Helper umgezogen

Vorher: `src/lib/storage/onedrive-provider-server.ts` (Klassenname
`OneDriveServerProvider`).

Nachher: `src/lib/storage/onedrive/oauth-server.ts` mit geschaerfter
Header-Dokumentation. Der Klassenname `OneDriveServerProvider` bleibt
unveraendert, weil:

- 1 Aufrufer (`src/app/api/auth/onedrive/callback/route.ts:5`) wurde auf
  den neuen Pfad migriert.
- Eine Umbenennung auf `OneDriveOAuthServer` braucht User-Abstimmung
  (siehe AGENT-BRIEF.md "Klassen-Name beibehalten oder ... vorschlagen").
- Der Klasse hier nur den Pfad zu aendern ist konservativ und macht
  Code-Review klein.

### 4.4 Helper `isFilesystemBacked()` + Pilot-Migration

Neue Datei: `src/lib/storage/library-capability.ts`.

Logik (storage-agnostisch, kein UI-Bezug):

```ts
export function isFilesystemBacked(library: Library | ClientLibrary | null | undefined): boolean {
  if (!library) return false
  const config = getShadowTwinConfig(library as Library)
  return config.primaryStore === 'filesystem' || config.persistToFilesystem
}
```

Pilot-Migration in `src/components/library/file-preview.tsx:1131-1133`:

Vorher:
```ts
const st = getShadowTwinConfig(activeLibrary as Library | null | undefined)
const transcriptOnFs = st.primaryStore === 'filesystem' || st.persistToFilesystem
```

Nachher:
```ts
const transcriptOnFs = isFilesystemBacked(activeLibrary as Library | null | undefined)
```

Tests: `tests/unit/storage/library-capability.test.ts` (6 Tests, fixiert
die OR-Semantik aus dem Original-Inline-Check).

## Char-Test-Status

| Test-File | Status | Anmerkung |
|---|---|---|
| `onedrive-provider-list-items.test.ts` (5) | ✅ | Unveraendert von Schritt 3 |
| `onedrive-provider-binary.test.ts` (5) | ✅ | Unveraendert von Schritt 3 |
| `onedrive-provider-error-paths.test.ts` (6) | ✅ | Unveraendert von Schritt 3 |
| `storage-factory-provider-selection.test.ts` (7) | ✅ | Unveraendert von Schritt 3 |
| `onedrive-errors.test.ts` (10) | ✅ neu | Schritt 4a: Helper-Tests |
| `library-capability.test.ts` (6) | ✅ neu | Schritt 4c: Helper-Tests |

Voller `pnpm test`-Lauf vor PR: **490/490 gruen**.

## Was bewusst NICHT in dieser Welle ist

| Was | Wieso | Wohin |
|---|---|---|
| `OneDriveProvider`-State auf 5 Sub-Module verteilen | Invasive Bewegung, Token-Refresh-Pfad ist Race-Condition-Hot-Spot | Folge-PR: "OneDrive-Provider voller Split mit Auth-Char-Tests" |
| `storage-factory.ts` (801 Z.) splitten | OneDrive-Provider hat Prioritaet, Factory ist sekundaer | Folge-PR (kann opportunistisch) |
| Aufraeumen aller `library.type ===`-Branches im Codebase | Gehoert teilweise zu Welle 9d (`file-preview`) | Welle 9d |
| Tests fuer `filesystem-provider.ts`, `nextcloud-provider.ts`, `shadow-twin.ts` | Welle 1 hat OneDrive-Fokus | Folge-PR |
| `storage-factory.ts` `console.warn` vor `throw` (Cargo-Cult) | Optional, gehoert nicht in Pflicht-Subset | Folge-PR |

## Stop-Bedingungen — was nicht passiert ist

- ✅ Kein Commit > 1.000 Zeilen Diff (groesster: 4a mit 143/30)
- ✅ Tests bleiben gruen nach jedem Commit (490/490)
- ✅ Keine Architektur-Frage offen, die nicht im AGENT-BRIEF geklaert ist
- ✅ Keine Live-OneDrive-/Mongo-Calls in Tests (alle Mocks)

## Folge-Schritte

| Schritt | Was | Wo |
|---|---|---|
| 5 | User-Test-Plan schreiben (Phase A/B/C/D) | `05-user-test-plan.md` |
| 6 | `storage-factory-mongodb.ts` + ggf. Doku-Verweise loeschen, knip pruefen | direkt + `06-acceptance.md` |
| 7 | Methodik-DoD + Modul-DoD in `06-acceptance.md` | `06-acceptance.md` |
