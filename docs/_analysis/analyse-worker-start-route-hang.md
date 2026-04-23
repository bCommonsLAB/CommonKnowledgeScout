# Analyse: `fetch failed` zwischen Worker und `/api/external/jobs/[jobId]/start`

Stand: 2026-04-23

## 1. Ausgangslage

Job `8e6264ff-54ff-42b1-ad05-9af059f45723` wird vom Worker geclaimt
und per `fetch()` an `/api/external/jobs/[jobId]/start` weitergereicht.
Nach exakt **5 Minuten** (= undici-Default `headersTimeout = 300_000 ms`)
schlägt der Worker mit `TypeError: fetch failed` fehl. Im Job stehen
danach nur:

```
trace.events: [ { name: "worker_dispatch", ts: 09:44:25.453 } ]
error:        { code: "worker_exception", message: "fetch failed" }
status:       "failed"
```

Im Secretary-Service kommt **kein** Request an. Es gibt also keine Spur
zwischen `worker_dispatch` und dem Worker-Catch.

## 2. Code-Status (Ist)

### 2.1 `src/lib/external-jobs-worker.ts` (Zeile 140–161)
- `fetch(startUrl, { method: 'POST', headers })` ohne `AbortController`,
  ohne explizites Timeout, ohne Elapsed-Time-Logging.
- Folge: Wir warten bis zum undici-Default (300 s), bekommen erst dann
  `fetch failed`, ohne zu wissen, *wo* es hing (Connect? Headers? Body?).

### 2.2 `src/app/api/external/jobs/[jobId]/start/route.ts`
- Erster `FileLogger.info`: Zeile 266 („Lade Datei aus Storage").
- Kein Trace-Event und kein Log direkt am Funktionseingang.
- Davor laufen blind: `await params`, `isInternalAuthorized`, ggf.
  `getAuth/currentUser` (bei nicht-internem Aufruf), `repo.get(jobId)`,
  `startWatchdog`, `provider = await getServerProvider(...)`.
- Jeder dieser Schritte kann hängen, ohne dass wir es sehen.

## 3. Drei mögliche Ursachen (alle plausibel, keine bewiesen)

A. **Routing/Compile-Hang** im Next dev-Server (HMR cold compile),
   der den POST nie an den Handler reicht.
B. **MongoDB-Connect/Pool-Hang** in `repo.get(jobId)` oder im
   `claimNextQueuedJob` davor (Replica-Set-Discovery, DNS).
C. **Storage-Provider-Hang** in `getServerProvider()` oder `getBinary()`
   (Nextcloud/OneDrive WebDAV blockiert auf totem Socket).

Solange wir nicht zwischen (A), (B), (C) unterscheiden können, ist jede
Code-Änderung Raten.

## 4. Drei Lösungsvarianten

### Variante 1 — Minimal: Sichtbarkeit + harte Worker-Timeouts (~30 Zeilen)

Betroffene Dateien:
- `src/lib/external-jobs-worker.ts`
- `src/app/api/external/jobs/[jobId]/start/route.ts`

Änderungen:
1. **Worker-Fetch:** `AbortController` mit konfigurierbarem Timeout
   (Default 60 s), Elapsed-Time-Log bei Erfolg *und* Fehler,
   Differenzierung `AbortError` vs. `TypeError: fetch failed`.
2. **`/start`-Eingang:** Sofortiger `FileLogger.info('start-route',
   'Route betreten', { jobId, ... })` + Trace-Event `start_route_entered`
   als allererste Aktion (vor `await params`).
3. **Erste fünf Schritte** (`params`, Auth, `repo.get`, `startWatchdog`,
   `getServerProvider`) jeweils in eigene `try/catch`-Blöcke mit
   Eingangs- und Erfolgs-Log + Dauer.

Effekt: Beim nächsten Hang sehen wir genau, ob die Route überhaupt
betreten wurde und welcher Schritt blockiert. Falls die Route nie
betreten wird → Ursache (A). Falls Eingangslog kommt aber nichts
weiteres → Ursache (B) oder (C), genauer eingrenzbar.

Risiko: gering. Keine Verhaltens-Änderung, nur Logs + ein Worker-Timeout
(60 s statt 300 s) — Nutzer bemerkt Fehler 4 Minuten früher.

### Variante 2 — Defensive: Variante 1 + Per-Step-Timeouts in /start

Zusätzlich zu V1: Helper `withTimeout(promise, ms, name)`, der jede
externe I/O-Operation in `/start` (Mongo, Storage, Secretary) hart
abbricht und mit klarer Fehlermeldung scheitert.

Risiko: mittel. Falsch gewählte Timeouts können legitime Langläufer
killen (z. B. großes PDF aus OneDrive laden > 60 s). Erfordert
Augenmaß bei den Default-Werten.

### Variante 3 — Architektonisch: Worker ruft `/start`-Logik direkt auf

Die `/start`-Logik wird in eine reine Funktion `executeJobStart(job)`
extrahiert. Der Worker ruft sie direkt (in-process) auf, statt
`fetch()` gegen die eigene HTTP-Route zu sprechen. Die HTTP-Route
bleibt für externe Worker-Pools erhalten und delegiert ebenfalls an
`executeJobStart`.

Vorteile: Eliminiert die gesamte Klasse von Netzwerk-/Compile-Fehlern
zwischen Worker und Route. Kein undici-Timeout mehr, kein HMR-Roulette.

Risiko: hoch. Großer Refactor (~200 Zeilen Bewegung), bricht ggf.
Annahmen über Request-Kontext (`NextRequest`-Headers, Auth-Bypass).
Entkoppelt aber zwei sehr lose verbundene Dinge sauber.

## 5. Empfehlung

**Variante 1** zuerst, *bevor* wir irgendetwas ändern. Ohne präzise
Diagnose-Daten ist V2 oder V3 verfrüht. Sobald V1 produktiv ist und der
nächste Fehlerfall die Ursache zeigt, kann gezielt nachgezogen werden:

- Ursache (A) → V3 wird sinnvoll.
- Ursache (B) → MongoDB-Pool/Connect prüfen, kein Code-Change in /start.
- Ursache (C) → V2 mit Timeout nur auf den Storage-Schritt.

## 6. Offene Fragen vor Umsetzung

- Soll der Worker-Timeout konfigurierbar via ENV sein
  (`JOBS_WORKER_START_TIMEOUT_MS`, Default 60_000)?
- Sollen wir bei `AbortError` den Job sofort als `failed` markieren oder
  in `queued` zurückgeben, damit der nächste Tick es erneut versucht?
  (Aktuell: sofort `failed`. Das ist bei einem Compile-Hang vielleicht
  unfreundlich.)
