# Website-Import (Sessions): File Map, Datenfluss, Contracts, Wiederverwendung

## Kontext / Ziel

In dieser App gibt es ein Feature, um **Sessions aus einer externen Webseite** zu extrahieren und anschließend im **Session Manager** zu speichern/anzuzeigen. Es unterstützt:

- **Einzel-Import**: eine Session-Seite → strukturierte Daten → Speicherung als Session.
- **Batch-Import**: eine Übersichtsseite → Liste von Session-Links (optional: Container-Selector) → iterativer Import jeder Session → Speicherung.

Du möchtest die **gleiche Grundlogik** in einer anderen App wiederverwenden (dort: *Jobs* statt *Sessions*), weiterhin über den **Secretary Service**.

Wichtig: Diese Doku beschreibt **nur** die lokale App-Seite (UI/Server/Client). Die konkrete Extraktionslogik (Template-Auswertung, Selector-Sprache, HTML-Parsing) liegt im Secretary Service und ist hier nicht vollständig verifizierbar.

---

## File Map (involvierte Dateien)

### UI (Session Manager + Import Dialog)

- `src/app/session-manager/page.tsx`
  - Rendert den **Session Manager**.
  - Öffnet den Import-Dialog („Aus Website importieren“).
  - Lädt Sessions über `GET /api/sessions` (Filter: search, event, track, day, source_language).

- `src/components/session/session-import-modal.tsx`
  - Import-Dialog mit Tabs **„Einzelne Session“** und **„Batch-Import“**.
  - Ruft `importSessionFromUrl(...)` auf (Client-Lib → API Proxy → Secretary Service).
  - Mappt `structured_data` in eine Session-Struktur und speichert via `POST /api/sessions`.
  - Batch: erwartet aus `structured_data` eine **Liste von Links** (Array oder Objekt-Wrapper) und importiert jeden Link seriell.

- `src/components/session/session-event-filter.tsx`
  - Dropdown für Event-Filter; lädt Events via `GET /api/sessions/events`.

### Client-Lib (Secretary Integration)

- `src/lib/secretary/client.ts`
  - `importSessionFromUrl(url, options)`:
    - Ruft **lokal** `POST /api/secretary/import-from-url` auf.
    - Setzt Default-Template: `ExtractSessionDataFromWebsite`.
    - Optional: `container_selector` wird nur gesendet, wenn nicht leer.
  - Fehlerklasse: `SecretaryServiceError`.

- `src/lib/secretary/adapter.ts`
  - `callTemplateExtractFromUrl(...)`:
    - Baut die Request-Payload für den Secretary Service als `application/x-www-form-urlencoded`.
    - Parameter: `url`, `source_language`, `target_language`, `template` oder `template_content`, `use_cache`, optional `container_selector`.
    - Validiert URL-Format (lokal) und wirft `HttpError(400, ...)` bei invaliden URLs.

- `src/lib/utils/fetch-with-timeout.ts`
  - `fetchWithTimeout(...)` + Fehlerklassen `TimeoutError`, `NetworkError`, `HttpError`.
  - Wird vom Adapter genutzt (Timeout/Netzwerk-Fehler-Klassifizierung).

### Server (Next.js App Router API)

- `src/app/api/secretary/import-from-url/route.ts`
  - Proxy-Endpunkt: **App → Secretary Service** (`/transformer/template`).
  - Holt `baseUrl`/`apiKey` aus `getSecretaryConfig()` (`SECRETARY_SERVICE_URL`, `SECRETARY_SERVICE_API_KEY`).
  - Unterstützt optional `templateId + libraryId` (Template aus MongoDB laden, serialisieren, als `template_content` senden).
  - Reicht Secretary-Antwort als JSON an den Client weiter.

- `src/app/api/sessions/route.ts`
  - `GET /api/sessions`: Session-Liste + `total` (filterbar).
  - `POST /api/sessions`: Bulk-Anlage (Array `sessions`), Pflichtfelder: `session`, `filename`, `event`, `track`.
  - `DELETE /api/sessions`: Bulk-Löschung via `ids`.

- `src/app/api/sessions/events/route.ts`
  - `GET /api/sessions/events`: liefert distinct `event` Werte aus DB (benötigt Auth via Clerk).

### Persistenz / Typen

- `src/lib/session-repository.ts`
  - MongoDB Repository für Sessions (Collection: `event_sessions`).
  - Bulk insert via `createSessions(...)` wird vom `/api/sessions` POST genutzt.

- `src/types/session.ts`
  - Typ `Session`, `SessionCreateRequest`, Filter-Optionen.

---

## Datenfluss (Single Import)

1. **UI**: Nutzer gibt Session-URL ein.
2. `SessionImportModal.handleImport()` ruft:
   - `importSessionFromUrl(url, { sourceLanguage, targetLanguage, useCache:false })`
3. `importSessionFromUrl` ruft **App API**:
   - `POST /api/secretary/import-from-url`
4. `POST /api/secretary/import-from-url` ruft **Secretary Service**:
   - `POST ${SECRETARY_SERVICE_URL}/transformer/template` (Form-encoded)
5. UI erwartet `response.data.structured_data` und zeigt Vorschau.
6. Nutzer bestätigt → `handleCreateSession()`:
   - mappt `structured_data` auf Session-Form (inkl. parse von comma-separated speakers)
   - `POST /api/sessions` mit `{ sessions: [sessionData] }`
7. Session Manager lädt Sessions neu (`loadSessions()`), alternativ `window.location.reload()` (im Modal ist beides vorhanden; Batch nutzt reload).

---

## Datenfluss (Batch Import)

1. **UI**: Nutzer gibt „URL der Session-Liste“ + „Eventname“ an.
2. Optional: „Container-Selector (XPath)“ wird gesetzt und als `container_selector` übertragen.
3. `handleExtractSessionList()` ruft:
   - `importSessionFromUrl(batchUrl, { template:'ExtractSessionListFromWebsite', containerSelector, ... })`
4. UI erwartet `structured_data` in einem dieser Formate:
   - direktes Array: `[{ name, url, track? }, ...]`
   - Objekt mit `items`: `{ items: [...] }`
   - Objekt mit `sessions`: `{ sessions: [...] }` (Rückwärtskompatibilität)
   - optional: `{ event: "..." }` (wird als Vorschlag in UI übernommen)
5. `handleBatchImport()` iteriert seriell über `sessionLinks[]`:
   - Für jeden Link: `importSessionFromUrl(link.url, default template)`
   - Map → `POST /api/sessions`
   - Status pro Link: pending/importing/success/error + Progressbar
   - Zwischen Requests: 1s Pause (Throttle)

---

## Contracts / Payloads (App ↔ Secretary ↔ App)

### App → `/api/secretary/import-from-url` (JSON)

Das UI sendet *implizit* über `importSessionFromUrl`:

- `url` (required)
- `source_language` (default `"en"`)
- `target_language` (default `"en"`)
- `template` (default `"ExtractSessionDataFromWebsite"`)
- `use_cache` (default `false`)
- optional: `container_selector` (nur wenn nicht leer)

### App → Secretary Service `/transformer/template` (Form URL Encoded)

Der Server-Proxy sendet (über `callTemplateExtractFromUrl`):

- `url`
- `source_language`
- `target_language`
- `use_cache`
- **entweder** `template` **oder** `template_content` (wenn Template aus DB geladen wird)
- optional: `container_selector`

**Hinweis zum Container-Selector**: In UI/Docs wird es als „XPath“ bezeichnet. Ob es tatsächlich XPath oder ein anderes Selector-Format ist, hängt vom Secretary Service ab (hier nicht überprüft).

### Secretary → App (Response Shape)

Der UI-Code verlässt sich auf:

- `status === 'success'`
- `data.structured_data` (für Single: Objekt; für Batch: Array oder Wrapper-Objekt)

Die genaue Struktur von `structured_data` wird in der UI bewusst tolerant behandelt (Type Guards + `unknown`).

### App → `/api/sessions` (JSON)

`POST /api/sessions` erwartet:

- `{ sessions: Array<SessionInput> }`
- Pflichtfelder je Session:
  - `session`, `filename`, `event`, `track`
- Optional u.a.:
  - `subtitle`, `description`, `url`, `day`, `starttime`, `endtime`, `speakers[]`,
  - `image_url`, `video_url`, `attachments_url`,
  - `source_language`, `target_language`,
  - `speakers_url[]`, `speakers_image_url[]`

---

## Wiederverwendung in einer „Jobs“-App: 3 Varianten

### Variante A — „Kopieren & Umbenennen“ (schnell, aber dupliziert)

Du kopierst die Feature-Scheibe und passt nur Domain-Namen/Mapping/Endpoints an:

- Kopiere UI-Modal (`session-import-modal`) → `job-import-modal`
- Kopiere Secretary Client-Funktion (oder nutze `importSessionFromUrl` generisch) → `importJobFromUrl`
- Ersetze `POST /api/sessions` durch `POST /api/jobs`
- Baue ein `JobRepository` + `/api/jobs` analog zu Sessions

**Vorteil**: minimaler Umbau, schnell lauffähig.  
**Nachteil**: Import-Logik driftet langfristig auseinander.

### Variante B — „Generisches Website-Import-Modul“ (empfohlen für zwei Apps)

Du extrahierst einen generischen Kern:

- **UI**: generische Komponente „WebsiteImportModal“ (URL, Batch-URL, container_selector, Templates)
- **Domain Mapper**: pro Zielobjekt ein kleines Mapping-Modul:
  - `mapStructuredDataToSession(...)`
  - `mapStructuredDataToJob(...)`
- **Persistenz**: pro App eigener Endpoint (`/api/sessions`, `/api/jobs`)

**Vorteil**: einmalige UI/Retry/Progress/Cancel-Logik; Domain bleibt sauber getrennt.  
**Nachteil**: etwas Refactoring-Aufwand (aber lokal begrenzt).

### Variante C — „Shared Package / Monorepo Library“ (sauber, aber organisatorisch schwerer)

Du machst aus Variante B ein Shared Package (z.B. internes npm package) oder ein Monorepo-Modul, das beide Apps verwenden:

- `@common/website-import` (UI + client contract + types)
- App-spezifisch bleibt nur:
  - Mapping
  - Storage Endpoints/Repos

**Vorteil**: echte Wiederverwendung über Repos hinweg, weniger Drift.  
**Nachteil**: Build/Versioning/Release-Prozess nötig.

---

## Minimaler „Was muss ich rüberkopieren“-Spickzettel (wenn du es 1:1 nachbaust)

Wenn du **nur** den Website-Import-Flow (Single+Batch) in einer anderen App nachbauen willst, sind typischerweise nötig:

- UI:
  - `src/components/session/session-import-modal.tsx` (anpassen auf Job-Domain)
  - Ein Trigger im Ziel-Screen (analog `src/app/session-manager/page.tsx`)
- Secretary Integration:
  - `src/lib/secretary/client.ts` (mindestens `importSessionFromUrl` und `SecretaryServiceError`)
  - `src/app/api/secretary/import-from-url/route.ts`
  - `src/lib/secretary/adapter.ts`
  - `src/lib/utils/fetch-with-timeout.ts`
  - `src/lib/env.ts` (wegen `getSecretaryConfig()`) + Env-Variablen
- Storage:
  - Ziel-API (analog `src/app/api/sessions/route.ts`) und Repository (analog `src/lib/session-repository.ts`)
  - Ziel-Typen (analog `src/types/session.ts`)

---

## Offene Punkte / Risiken (für robuste Wiederverwendung)

- **Selector-Semantik**: Der Parameter heißt „XPath“, aber die Implementierung ist im Secretary Service. Für die Jobs-App sollte die Doku/UX exakt dem entsprechen, was Secretary wirklich akzeptiert.
- **Template-Namen**: `ExtractSessionDataFromWebsite` und `ExtractSessionListFromWebsite` sind hier nur Strings. Sie müssen auf Secretary-Seite existieren, sonst scheitert der Import.
- **Response Shape**: `structured_data` wird „weich“ geparst. Das ist pragmatisch, aber ohne feste Contract-Tests kann es bei Template-Änderungen still brechen.

