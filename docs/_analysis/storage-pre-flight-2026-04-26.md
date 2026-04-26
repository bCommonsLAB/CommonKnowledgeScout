# Pre-Flight-Analyse: `storage`-Modul

Datum: 2026-04-26. Erstellt vor Start von Welle 1.

Beantwortet zwei Architektur-Fragen aus
[`docs/refactor/storage/AGENT-BRIEF.md`](../refactor/storage/AGENT-BRIEF.md)
direkt aus dem Source.

## Frage 1: Ist `storage-factory-mongodb.ts` Duplikat zu `storage-factory.ts`?

**Antwort: JA, und es ist toter Code.**

### Beleg 1 — Null Imports im `src/`-Tree

```
rg "MongoDBStorageFactory|storage-factory-mongodb" src/**/*.{ts,tsx}
→ nur Selbst-Referenzen in src/lib/storage/storage-factory-mongodb.ts
```

Die Doku-Aussage in `docs/reference/modules/storage.md`
"API routes use MongoDB factory" ist **veraltet** — der Code wurde entfernt,
das `@usedIn`-JSDoc nicht nachgepflegt.

### Beleg 2 — Funktional eingeschraenkt

`MongoDBStorageFactory.getProvider()` (Zeile 312-331) hat **keinen Switch**
nach `library.type`:

```326:326:src/lib/storage/storage-factory-mongodb.ts
    const provider: StorageProvider = new LocalStorageProvider(library);
```

Hardcoded auf `local`. Im Vergleich `StorageFactory.getProvider()`
(Zeile 720-769) verzweigt sauber nach `local` / `onedrive` / `nextcloud`.

### Beleg 3 — Eigene `LocalStorageProvider`-Klasse ist veraltete Kopie

`storage-factory-mongodb.ts` enthaelt ein eigenes `LocalStorageProvider`
(Zeile 33-244) ohne:

| Feature | `storage-factory.ts` | `storage-factory-mongodb.ts` |
|---|---|---|
| `pendingRequests`-Deduplizierung | ja | nein |
| Differenzierte HTTP-Fehler (404/400/500) | ja | nein, nur `'Failed to ...'` |
| `AuthLogger`-Integration | ja | nein |
| ZIP-Server-Side-Extract | ja | nein |
| `setUserEmail` + Email-Param-Anhaengung | ja | nein |
| `deleteItem` API-Pfad | korrekt (kein `action=`) | **falsch** (`?action=delete`) |
| `moveItem` API-Pfad | korrekt | **falsch** (`?action=move`) |

Die letzten zwei Punkte beweisen besonders, dass die Klasse seit langem
ungenutzt ist — die Bugs waeren sonst aufgefallen.

### Konsequenz

`storage-factory-mongodb.ts` wird in **Schritt 6 (Dead-Code)** geloescht.
`pnpm knip` soll vor dem Loeschen bestaetigen.

---

## Frage 2: Ist `onedrive-provider-server.ts` Strangler-Fig zu `onedrive-provider.ts`?

**Antwort: NEIN.** Eigenstaendiger OAuth-Server-Helper.

### Beleg 1 — Anderer Klassenname, andere Schnittstelle

| | `onedrive-provider.ts` | `onedrive-provider-server.ts` |
|---|---|---|
| Klassen-Name | `OneDriveProvider` | `OneDriveServerProvider` |
| Implementiert `StorageProvider` | **ja** | **nein** |
| Methoden | `listItemsById`, `getBinary`, `uploadFile`, ... (volles Interface) | `authenticate(code)`, `saveTokensTemporarily()` (nur 2) |
| Aufrufer | `StorageFactory.getProvider()` (`storage-factory.ts:731`) + `createOneDriveProviderForAuth()` (Zeile 799) | **genau 1**: `src/app/api/auth/onedrive/callback/route.ts:122` |

Strangler-Fig haette **gleiche Schnittstelle** und **gleichen Klassen-Namen**.
Hier ist beides verschieden — bewusste Trennung.

### Beleg 2 — Datei-Header sagt es

```12:14:src/lib/storage/onedrive-provider-server.ts
/**
 * Serverseitige Implementierung des OneDrive Providers
 * Enthält nur die für die Authentifizierung notwendigen Methoden
```

### Beleg 3 — Funktional disjunkt

`OneDriveServerProvider` macht ausschliesslich:

1. `getRequiredConfigValues()` — Config aus `library.config` lesen + validieren
   (z.B. Heuristik "Client Secret sieht aus wie ID statt Value", Zeile 53-57)
2. `authenticate(code)` — POST gegen `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`
   mit `grant_type=authorization_code` (Zeile 107-124)
3. `saveTokensTemporarily()` — `tempAccessToken`/`tempRefreshToken` in
   `library.config` schreiben, damit Client sie einmalig abholt (Zeile 171-211)

Diese Logik ist in `OneDriveProvider` **nirgends** abgebildet — der erwartet
bereits ein gueltiges Token.

### Konsequenz

`onedrive-provider-server.ts` bleibt erhalten. In **Schritt 4 (Altlast-Pass)**
wird die Datei nach `src/lib/storage/onedrive/oauth-server.ts` umgezogen
(passt zum geplanten OneDrive-Sub-Modul-Split). Klassen-Name ggf. zu
`OneDriveOAuthServer` schaerfen — entscheidet User vor Umsetzung.

---

## Status

Beide Vorab-Entscheidungen sind in den Welle-1-Dokumenten verankert:
- `docs/refactor/storage/AGENT-BRIEF.md` Schritt 0, 4, 5, 6
- `docs/refactor/storage/01-inventory.md` Sektion 8
