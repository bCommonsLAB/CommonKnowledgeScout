# Secretary Pre-Flight-Health-Check (generisch, endpoint-spezifisch)

- **Status**: Analyse (Entscheidung offen) — eigener Branch
- **Auslöser**: Wizard-Job scheiterte mit `fetch failed` an
  `http://127.0.0.1:5001/api/pdf/process-mistral-ocr`; Worker requeued 3×, dann
  `failed`. Erst nach ~9 s/3 Versuchen sichtbar. Secretary war schlicht nicht
  erreichbar (TCP-Connect abgelehnt).
- **Ziel**: Vor JEDEM Prozess, der den Secretary nutzt, **den konkret benötigten
  Endpoint** prüfen — generisch, ohne grossen Performance-Verlust.

## Secretary Health-API (vorhanden, nutzbar)

Quelle: `docs/_secretary-service-docu/health.md`. Kein Auth nötig.

| Endpoint | Zweck |
|---|---|
| `GET /api/health/live` | Liveness (keine Deps) — nur „Prozess da?" |
| `GET /api/health/endpoint/{endpoint}` | **Kaskadierender** Check je Endpoint (`pdf`, `audio`, `video`, `transformer`, `rag`, `image_analyzer`, `session`, …) → aggregiert die transitiven Use-Cases, liefert den **schlechtesten** Status |
| `GET /api/health/use-case/{use_case}` | Einzelner Use-Case (`ocr_pdf`, `transcription`, `chat_completion`, `embedding`, …) |

**Status:** `healthy` · `degraded` (z.B. wenig OpenRouter-Credit) · `unavailable`
(Config kaputt / Key fehlt / Provider offline / Credit leer) · `unknown` ·
`no_llm_dependency`. HTTP ist immer 200 (ausser 404 bei unbekanntem Endpoint) —
**Status aus dem Body lesen**, nicht aus dem HTTP-Code.

**Wichtig:** Der Secretary **cached** Health-Ergebnisse ~30 s pro Use-Case (pro
Worker). Häufiges Pollen hämmert die Provider also nicht.

## Zugriffspunkte im Code (Scope)

Der reale Ziel-Secretary wird **server-seitig** erreicht:

- **External-Jobs `start`-Route** → `src/lib/external-jobs/secretary-request.ts`
  (PDF-OCR/Transcribe/Transform — hier scheiterte der Job).
- **Proxy-Routen** `src/app/api/secretary/*` (process-pdf, -audio, -video,
  -image, -text, session/process, tracks/…, import-from-url).
- **`embedTextRag`** in `src/lib/secretary/client.ts` (direkt, RAG-Embedding).

Client-Helfer (`src/lib/secretary/client.ts`) rufen die **Proxy-Routen** auf —
ein server-seitiger Check an einer zentralen Stelle deckt sie also mit ab.

Konsequenz: Es braucht eine **Endpoint-Map** (interner Vorgang → Secretary-
Endpoint-Name), z.B. `pdf-Job → 'pdf'`, `audio → 'audio'`, `transform → 'transformer'`,
`RAG-Ingest → 'rag'`, `image-analyzer → 'image_analyzer'`. Neue Vorgänge müssen
sich **explizit** eintragen (kein Default — `no-silent-fallbacks`).

## Varianten

### V1 — Inline-Check pro Aufruf (ohne Cache)
Vor jedem Secretary-Call ein `GET /health/endpoint/{ep}`.
- ➕ Maximal aktuell, simpel.
- ➖ +~50–150 ms **pro** Aufruf; bei vielen Jobs spürbar. Verfehlt „ohne
  Performance-Verlust".

### V2 — Zentraler Helfer mit TTL-Cache (empfohlen)
Ein server-seitiger Helfer `ensureSecretaryEndpointHealthy(endpoint)` mit
**In-Process-Cache** (TTL ~15–30 s, passend zum Secretary-eigenen 30 s-Cache),
Key = Endpoint-Name. Erster Aufruf pro Endpoint/Fenster macht den HTTP-Check,
danach **Cache-Treffer ≈ 0 ms**.
- ➕ Praktisch kein Hot-Path-Overhead; eine Quelle der Wahrheit; einfach testbar.
- ➕ Schnelles, klares Scheitern statt 3× Requeue/Timeout.
- ➖ Cache kann bis TTL veralten (akzeptabel; realer Call fängt Restfehler ab).

### V3 — Hintergrund-Poller (warmer Cache)
Ein Singleton (analog `ExternalJobsWorker`) pollt periodisch (z.B. alle 20 s)
`/health/endpoint/*` für die **bekannten** Endpoints und hält eine Status-Map.
Aufrufer lesen **synchron** aus der Map → Hot-Path garantiert 0 ms.
- ➕ Null Latenz auf dem kritischen Pfad; „Hintergrundtask" wie gewünscht.
- ➖ Mehr bewegliche Teile (Lebenszyklus, Dev/HMR, pollt auch ohne Last).

## Empfehlung

**V2 als Kern**, optional später **V3** als Warm-Layer darüber (dieselbe Cache-
Abstraktion: V3 füllt den Cache, den V2 liest). Start mit V2 ist die einfachste
Lösung mit dem grössten Nutzen und deckt „ohne grossen Performance-Verlust" ab.

## Status-Handling (verbindlich, kein Silent Fallback)

Zwei Ebenen, explizit getrennt:

1. **Erreichbarkeit** (Connectivity / `live`): TCP/`fetch failed` → klarer Fehler
   „Secretary nicht erreichbar unter {URL}". (Das war der aktuelle Fall.)
2. **Endpoint-Bereitschaft** (`/health/endpoint/{ep}`):
   - `unavailable` → **abbrechen**, klare Meldung (welcher Use-Case, welcher
     Provider, welche Ursache aus `detail`).
   - `degraded` → **fortfahren + warnen** (z.B. wenig Credit).
   - `healthy` → fortfahren.
   - `unknown` → fortfahren **+ loggen** (nicht blockieren — kein False-Negative).

## Einbau-Punkte (nach Entscheidung)

- Zentraler Helfer `src/lib/secretary/health.ts`:
  `ensureSecretaryEndpointHealthy(endpoint)` + Endpoint-Map + TTL-Cache.
- Aufruf in `secretary-request.ts` (External-Jobs) **vor** dem Submit.
- Aufruf in den `/api/secretary/*`-Proxy-Routen (oder in deren gemeinsamer
  Vorbereitungs-Schicht), damit Client-Pfade automatisch profitieren.
- `embedTextRag` → Endpoint `rag` prüfen.

## Offene Fragen (vor Umsetzung klären)

- TTL exakt (15 s vs 30 s)? Konfigurierbar via env (`SECRETARY_HEALTH_TTL_MS`)?
- `degraded` im Job-Kontext: nur loggen oder als Job-Warnung sichtbar machen?
- Endpoint-Map: zentral pflegen vs. pro Aufrufer übergeben (Tendenz: zentrale
  Map + Aufrufer gibt nur den Endpoint-Namen).
- V3 jetzt mitbauen oder erst bei Bedarf? (Tendenz: später.)

## Scheiben (jede: `pnpm test` + `pnpm lint` grün, dann Owner testet)

1. **H1** — Helfer `ensureSecretaryEndpointHealthy` + Endpoint-Map + TTL-Cache +
   Unit-Tests (gemockter `fetch`: healthy/degraded/unavailable/unknown/offline).
2. **H2** — Einbau in `secretary-request.ts` (External-Jobs): Pre-Flight vor dem
   PDF/Audio/Transform-Submit; klares Scheitern statt Requeue-Schleife.
3. **H3** — Einbau in `/api/secretary/*`-Proxy-Routen (deckt Client-Pfade ab).
4. **H4** — `embedTextRag` (RAG) + restliche Direktaufrufe.
5. **H5** (optional) — V3 Hintergrund-Poller als Warm-Layer.

## Branch

Eigener Branch, getrennt vom Wizard-Strang (ADR-0001: Domänen nicht mischen).
Vorschlag: `feat/secretary-preflight-healthcheck`.
