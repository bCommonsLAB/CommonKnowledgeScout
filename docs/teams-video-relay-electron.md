# Teams-Video-Relay (Electron)

## Zweck

Lokale Electron-App lädt eine Microsoft-Teams-Aufzeichnung aus SharePoint (`stream.aspx`-URL) mit **delegierter** Benutzeranmeldung (Microsoft Graph, Scope `Files.Read`) und überträgt die Datei in Chunks an die Next.js-Route `/api/stream-ingest/*`. Nach vollständigem Upload leitet der Server an den **Secretary-Service** (`/video/process`) weiter – ohne direkten Firmen-Storage-Zugriff des Secretary.

## Konfiguration

1. **Azure AD**: Öffentliche Client-Anwendung; Scope `Files.Read` (delegiert); Redirect-URIs für Desktop/Loopback (Microsoft-Dokumentation zu MSAL Node `acquireTokenInteractive`).
2. **`.env`**: `ELECTRON_MSAL_CLIENT_ID` setzen; optional `ELECTRON_MSAL_TENANT_ID` (Default `organizations`).
3. **Clerk**: Nutzer muss in der Desktop-App angemeldet sein (Cookies für `/api/stream-ingest`).
4. **Secretary**: `SECRETARY_SERVICE_URL` (und ggf. API-Key) wie für bestehende `/api/secretary/process-video`-Route.

## UI

Einstellungen → Transformation: Panel **Teams-Aufzeichnung (Electron → Secretary)** (nur sichtbar, wenn `window.electronAPI` gesetzt ist).

## Unterstützte URLs

Nur `https://…sharepoint.com/…/stream.aspx?id=` mit `id`-Pfad der Form `/personal/…/Documents/…`. Andere Muster werden **explizit** abgelehnt (keine stillen Fallbacks).

## Technische Bausteine

- `electron/stream-resolver.js` – URL → Graph-Pfad `Documents/…`
- `electron/msal-auth.js` – MSAL Public Client + Datei-Cache unter `userData`
- `electron/stream-relay.js` – Range-Download von Graph, Chunk-POST an Next
- `src/app/api/stream-ingest/{init,chunk,complete}/route.ts`
- `src/lib/stream-ingest/upload-session-store.ts` – In-Memory-Sessions + Temp-Datei

## Tests

Unit: `tests/unit/electron/stream-resolver.test.ts` (Vitest).

## Grenzen (Phase 1)

- Vollständige Datei wird nach dem Zusammensetzen der Chunks für den Secretary erneut in den Speicher gelesen (analog zu `/api/secretary/process-video`).
- Upload-Sessions leben nur im Prozess-Speicher (Restart = abgebrochene Uploads).
