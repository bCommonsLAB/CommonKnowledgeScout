# Characterization Tests: Modul `storage`

Stand: 2026-04-26. Erstellt vom Cloud-Agent (Welle 1, Plan-Schritt 3).

Bezug:
- Contracts: [`02-contracts.md`](./02-contracts.md), [`storage-contracts.mdc`](../../../.cursor/rules/storage-contracts.mdc)
- Audit: [`00-audit.md`](./00-audit.md) — alle 6 Bestands-Tests `keep`
- Vorbild: [external-jobs/03-tests.md](../external-jobs/) (war als
  `02-tests.md` Teil von PR #15 in der Pilot-Welle)

## Was wurde gemacht

4 neue Test-Files mit insgesamt **23 Tests** hinzugefuegt. Sie fixieren das
beobachtete Verhalten der zwei groessten ungetesteten Files
(`onedrive-provider.ts` 2.108 Z., `storage-factory.ts` 801 Z.) **vor** dem
Schritt-4-Split.

| Test-File | Tests | Coverage-Ziel |
|---|---:|---|
| `tests/unit/storage/onedrive-provider-list-items.test.ts` | 5 | `OneDriveProvider.listItemsById` (Mapping, Pagination, Deduplizierung, baseFolderId, API-Fehler) |
| `tests/unit/storage/onedrive-provider-binary.test.ts` | 5 | `OneDriveProvider.getBinary` (Item-ID-Pfad, root-Sonderfall, Folder-Reject, Base64-Pfad-Aufloesung, API-Fehler) |
| `tests/unit/storage/onedrive-provider-error-paths.test.ts` | 6 | Fehler-Semantik §2: leere ID, root-Operationen verboten, AUTH_REQUIRED ohne Token |
| `tests/unit/storage/storage-factory-provider-selection.test.ts` | 7 | `StorageFactory.getProvider` Auswahl je `library.type`, Cache, NotFound, UnsupportedType, `setLibraries([])`-Sonderfall |

## Test-Strategie

### Kein Live-Call gegen Microsoft Graph

Wie im AGENT-BRIEF gefordert (Stop-Bedingung): keine echten OneDrive-Calls.

- **Mock**: `vi.stubGlobal('fetch', fetchMock)`, der `Microsoft Graph API`
  und interne Token-API-Aufrufe abfaengt.
- **Auth-Bypass**: Ueber `provider as unknown as ProviderInternals` werden
  `accessToken`, `refreshToken`, `tokenExpiry`, `authenticated`,
  `baseFolderId`, `basePath` direkt gesetzt. Damit umgehen wir die
  Token-Loading-Logik (DB / localStorage), die fuer den
  Listing-/Binary-Vertrag irrelevant ist.
- **Reset**: `beforeEach`/`afterEach` ruft `vi.unstubAllGlobals()`, sodass
  Tests sich nicht beeinflussen.

### StorageFactory ist Singleton — wie testen

`StorageFactory.getInstance()` liefert eine Singleton-Instanz. Damit Tests
nicht durch Cross-Test-State brechen:

```typescript
function resetSingleton(): void {
  const factory = StorageFactory.getInstance() as unknown as FactoryInternals
  factory.providers.clear()
  factory.libraries = []
  factory.serverContext = false
  factory.userEmail = null
  factory.apiBaseUrl = null
}
beforeEach(resetSingleton)
afterEach(resetSingleton)
```

Das ist explizit dokumentiert; bei einem spaeteren Refactor (nicht in
Welle 1) koennte man `StorageFactory.resetForTests()` als oeffentliche
Methode anbieten.

## Was die Tests fixieren

### `listItemsById`

- Mapping `OneDriveFile -> StorageItem`: `mimeType` aus `file.mimeType`
  oder `'application/folder'` fuer Ordner; `parentId` aus
  `parentReference.id` mit Fallback `'root'`.
- Pagination via `@odata.nextLink`: alle Seiten werden aggregiert, in
  Reihenfolge.
- `folderId='root'` mit `baseFolderId !== 'root'` → Endpunkt `/items/{baseFolderId}/children`
  (kein Direkt-`/root/children`).
- **Deduplizierung paralleler Aufrufe**: zwei `listItemsById('folder-x')`
  in Folge erzeugen genau **einen** fetch-Call und liefern dieselbe
  Promise/Result-Referenz. Das ist Vertragsbasis fuer
  `provider-request-cache.ts` (§1, §6).
- API-Fehler werden als `StorageError` mit `code='API_ERROR'` und
  `provider=library.id` durchgereicht.

### `getBinary`

- Korrekter 2-Call-Flow fuer Item-IDs: zuerst Item-Info (fuer MIME-Typ und
  Folder-Check), dann Content-Endpunkt.
- `getBinary('root')` → `StorageError "INVALID_OPERATION"` ohne fetch-Call.
- Folder-IDs werden nach Item-Info als `INVALID_OPERATION` abgewiesen.
- Base64-Pfad-Erkennung: ein Pfad wie `sub/file.pdf` (Base64-codiert) wird
  via `/drive/root:/Library/sub/file.pdf` aufgeloest, dann normaler
  Item-Info-Call + Content-Call.
- Item-Info-API-Fehler → `StorageError "API_ERROR"`.

### Error Paths

- `getItemById('')` und `getItemById('   ')` → `INVALID_INPUT` ohne
  fetch-Call.
- `deleteItem('root')`, `moveItem('root', _)`, `renameItem('root', _)` →
  `INVALID_OPERATION` ohne fetch-Call.
- `isAuthenticated()` ist `true` nach Token-Set, `false` ohne Tokens.
- `listItemsById` ohne Tokens → `AUTH_REQUIRED` (Token-Loading scheitert,
  ensureAccessToken wirft).

### `StorageFactory.getProvider`

- Provider-Auswahl je `library.type`: 'local' → `'Local Filesystem'`,
  'onedrive' → `'Microsoft OneDrive'`, 'nextcloud' (Client-Kontext) →
  `'Nextcloud (WebDAV)'`.
- **Caching** pro libraryId: zweiter Aufruf liefert dieselbe Instanz.
- Unbekannte libraryId → `LibraryNotFoundError` mit
  `errorCode='LIBRARY_NOT_FOUND'` und `libraryId`-Feld.
- Unbekannter `library.type` (z.B. `'gdrive'`) → `UnsupportedLibraryTypeError`
  mit `errorCode='UNSUPPORTED_LIBRARY_TYPE'`. **Kein** Fallback auf
  `'local'` (Verstoss gegen §4).
- `setLibraries([])` als Sonderfall: behaelt vorhandene Library-Liste
  und Provider-Cache (dokumentiert in `storage-factory.ts:644-664`).

## Was bewusst NICHT getestet wird (Welle 1)

- **`OneDriveProvider.authenticate()` und `getAuthUrl()`** — gehoeren in
  den Sub-Modul-Split (`onedrive/auth.ts`); werden in Folge-PR getestet.
- **Token-Refresh-Flow** — selbst groesser als die Char-Tests, eigene
  Test-Suite in spaeterer Welle.
- **Rate-Limit-Queue / Retry-Logik** — Implementierungs-Detail, nicht
  Vertrag (`fetchWithRetry`, `processRequestQueue`); kann sich in
  Schritt 4 (`onedrive/cache.ts`) aendern.
- **Server-Kontext** in `getProvider` (NextcloudProvider direkt via WebDAV) —
  benoetigt dynamischen Import des `webdav`-Pakets, wird nicht mit
  HTTP-Proxy getestet. Indirekt via Schritt-5-User-Test abgedeckt.
- **`filesystem-provider.ts`, `nextcloud-provider.ts`, `filesystem-client.ts`,
  `shadow-twin.ts`** — Folge-PRs, siehe `00-audit.md`.

## Test-Lauf vor Schritt-4-Aenderungen

```
$ pnpm test
Test Files  101 passed (101)
     Tests  474 passed (474)
```

Vorher (Baseline): 97 Files / 451 Tests. Delta: +4 Files / +23 Tests.

Diese Char-Tests sind das **Sicherheitsnetz** fuer den OneDrive-Modul-Split
in Schritt 4. Ein "rotes Lampen-Test" am Ende von Schritt 4 zeigt sofort,
ob der Split die API gebrochen hat.

## Folge-Schritte

| Schritt | Was | Wo |
|---|---|---|
| 4 | Char-Tests muessen nach jedem Sub-Modul-Move gruen bleiben | lokal `pnpm test` |
| 7 | Test-Lauf mit gruenem Status in `06-acceptance.md` dokumentieren | `06-acceptance.md` |
| Spaeter | Tests fuer `filesystem-provider.ts`, `nextcloud-provider.ts`, `shadow-twin.ts` | Folge-PRs |
