# Welle-Agent-Brief: Welle 2.1 — Modul `secretary`

Stand: 2026-04-27. Erstellt vom IDE-Agent als Pre-Flight fuer Welle 2.1,
direkt nach erfolgreicher Welle 1 (`storage` + `shadow-twin` + `ingestion`)
und nach Merge von PR #294 (composite-multi-image).

## Kontext (lies das ZUERST)

1. **Methodik & Workflow-Regeln**: [`docs/refactor/playbook.md`](../playbook.md)
   - insbesondere R1-R5 (kein Push auf master ohne User-OK, kein Parallelismus).
2. **Vorbild-Wellen** (in dieser Reihenfolge ansehen):
   - [`docs/refactor/external-jobs/`](../external-jobs/) (Pilot, lehrt Methodik)
   - [`docs/refactor/storage/`](../storage/) (Welle 1.1)
   - [`docs/refactor/shadow-twin/`](../shadow-twin/) (Welle 1.2)
   - [`docs/refactor/ingestion/`](../ingestion/) (Welle 1.3, **direktestes Vorbild** — gleiche Modul-Groesse, gleicher Helper-Extract-Stil)
3. **Plan-Bezug**: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md)
   Sektion 5 Welle 2 Verarbeitung (Modul `secretary` als 1. von 3 Verarbeitungs-Modulen).
4. **Repo-Konventionen**: [`AGENTS.md`](../../../AGENTS.md).
5. **Inventur** (schon erstellt): [`01-inventory.md`](./01-inventory.md).

## Aufgabe

Du bist **EIN** Agent (R2 — Default 1 Cloud-Agent, alternativ IDE-Agent
nur fuer kompakte Module mit User-Mit-Lesung). Du arbeitest die 8
Schritte der Methodik **seriell** durch, fuer das Modul `secretary`.

Output landet in:

- `docs/refactor/secretary/00-audit.md`
- `docs/refactor/secretary/02-contracts.md`
- `docs/refactor/secretary/03-tests.md`
- `docs/refactor/secretary/04-altlast-pass.md`
- `docs/refactor/secretary/05-user-test-plan.md`
- `docs/refactor/secretary/06-acceptance.md`

Code-Aenderungen landen direkt in `src/lib/secretary/`, neue Tests in
`tests/unit/secretary/` (Verzeichnis existiert mit 4 Bestands-Tests).
Eine modul-spezifische Contract-Rule
`.cursor/rules/secretary-contracts.mdc` wird neu erstellt.

## Vorab-Entscheidungen (vom IDE-Agent vor Start geklaert)

### E1: Externer Service ist Tabu

`secretary` ist Wrapper zu einem **externen** Python-Service (siehe
`docs/_secretary-service-docu/`). **Welle 2.1 aendert weder den externen
Service noch dessen API-Vertraege.** Nur die TS-Wrapper-Schicht in
`src/lib/secretary/` ist Scope.

Wenn beim Audit auffaellt, dass externe API-Vertraege widerspruechlich
oder undokumentiert sind: dokumentieren, NICHT aendern. Folge-Initiative.

### E2: `client.ts` (1.222 Z.) Split-Strategie

**Pragmatisch wie `image-processor.ts` in Welle 1.3**:

1. Erst Char-Tests fuer alle 14 oeffentlichen Funktionen
   (mind. 1 Happy-Path je grosser Funktion).
2. Dann pure Helper extrahieren in `src/lib/secretary/client-helpers.ts`
   (oder mehrere Files):
   - Token-Refresh-Logik (Zeilen ~700-730 inkl. dem `catch {}`)
   - FormData-Builder fuer PDF/Audio/Video/Image
   - Streaming-Reader fuer Server-Sent-Events / Chunked Responses
   - URL-Builder mit `getSecretaryConfig()`
3. Klasse / Modul-Fassade belassen (14 Exporte bleiben).

**NICHT** in dieser Welle:

- Voller Split nach Endpunkt-Typ (audio.ts / pdf.ts / video.ts / image.ts /
  session.ts) — Folge-PR.
- Adapter-Schicht ueberhaupt umbenennen oder zusammenlegen — siehe E3.

Mindest-Ziel: `client.ts < 800 Zeilen` durch Helper-Extraction.
Stretch-Ziel: `< 600 Zeilen`.

### E3: Verhaeltnis `client.ts` ↔ `adapter.ts`

Beide sind HTTP-Wrapper zum Secretary-Service. `client.ts` ist
high-level (typisierte Response-DTOs), `adapter.ts` ist low-level
(`Response`-Roh-Objekt). Audit Schritt 0 muss klaeren:

- **Sind beide unterschiedliche Layer** (high vs. low) oder
  **historische Drift** (zwei parallele Wege fuer dieselbe Sache)?
- Falls Drift → Strangler-Fig (Schritt 5) ist relevant, ein Layer wird
  kanonisch.
- Falls Layer-Trennung → Contracts (Schritt 2) muss das festschreiben.

**Default-Annahme**: beide bleiben, Vertrag wird in §3 der neuen
Contract-Rule fixiert. Strangler-Fig ist Folge-Initiative, nicht diese
Welle.

### E4: Char-Test-Status

Modul hat **3 Bestands-Test-Files** (4 wenn man die fehlplatzierte
`process-video-job-defaults.test.ts` mitzaehlt):

- `extract-audio-text.test.ts` — pure Funktion, OK
- `response-parser.test.ts` — Frontmatter-Parser, OK
- `image-analyzer-multi.test.ts` — neu via PR #294, multi-image
- `process-video-job-defaults.test.ts` — testet API-Route, **nicht**
  `secretary/`-Code. Audit-Frage: nach `tests/unit/api/secretary/`
  verschieben oder lassen?

Welle 2.1 fokussiert auf:

- 1 neues Test-File pro untestetem Quell-File (`client.ts`,
  `adapter.ts`, optional `constants.ts`)
- Mind. 1 Happy-Path + 1 Fehler-Pfad pro grosser Funktion
- Insgesamt **15-25 neue Tests** (analog `ingestion`-Welle).

Mocks sind Pflicht:

- `vi.mock('@/lib/utils/fetch-with-timeout')` fuer alle HTTP-Calls
- `vi.mock('@/lib/env')` fuer `getSecretaryConfig`
- Kein Live-Call zum echten Secretary-Service, niemals.

### E5: `catch {}` in `client.ts:731`

**Pflicht-Fix in Schritt 4**. Der Block schweigt einen
Token-Persist-Fehler (PATCH `/api/libraries/{id}/tokens`). Optionen:

1. `console.warn` + bewusstes Default-Verhalten ("Token-Persist
   fehlgeschlagen, nicht kritisch da localStorage gefuellt") → Kommentar
   begruendet warum kein Throw.
2. `logger.warn`-Aufruf via `src/lib/logging/`.
3. Fehler weitergeben — riskant, weil Token-Refresh
   im Feuer-und-vergessen-Stil laeuft.

**Empfehlung**: Option 2 (Logging) plus expliziter Kommentar.

### E6: UI-Komponenten importieren direkt aus `secretary`

`src/components/event-monitor/`, `src/components/creation-wizard/steps/`
und `src/components/library/file-preview.tsx` haben direkte Imports.

Audit Schritt 0 dokumentiert. **Welle 2.1 aendert dies NICHT**, weil
das die UI-Welle 3 betrifft. Findings werden als "Watchpoint fuer
Welle 3" festgehalten.

### E7: Modul-DoD vs. Welle 1.3

| Kriterium | Erwartung | Begruendung |
|---|---|---|
| `pnpm test` gruen | aktuell + 15-25 neue Tests | Char-Tests sind Hauptlast |
| `pnpm lint` ohne neue Errors | 0 | unveraendert |
| Files | 7 + 1-3 (Helper) = 8-10 | Helper aus client.ts |
| Max-Zeilen | 1.222 → **< 800** (Pflicht) | Helper-Extracts |
| > 200 Zeilen | 3 → **2-3** | client + adapter ggf. > 200; image-analyzer (216) bleibt grenzwertig |
| Leere Catches | 1 → **0** | Pflicht-Fix client.ts:731 |
| `any` | 0 | bleibt |
| Cross-Modul-Test verschoben | `process-video-job-defaults.test.ts` an passenden Ort | Audit-Findings umsetzen |

**Stretch (nicht Pflicht)**: `client.ts < 600 Z.`, > 200 Zeilen = 1.

## Schritt-fuer-Schritt-Ablauf

### Schritt 0 — Bestands-Audit

- File: `docs/refactor/secretary/00-audit.md`
- 3 Tabellen (Rules, Tests, Docs) wie Welle-1.3-Vorlage.
- **Rules zu pruefen**: `shadow-twin-contracts.mdc` (Erwaehnung von
  Secretary), `contracts-story-pipeline.mdc`, `no-silent-fallbacks.mdc`,
  `storage-abstraction.mdc`, plus pruefen ob `ingestion-contracts.mdc`
  Secretary erwaehnt.
- **Tests**: alle 4 Files in `tests/unit/secretary/`. Pro Test
  bewerten: testet welchen Code, Code existiert noch ja/nein/umbenannt
  (besonders Image-Analyzer nach PR #294!), Vertrag korrekt, Aktion
  (keep / migrate / delete).
- **Docs**: alle `docs/_secretary-service-docu/*.md`,
  `docs/diktat-secretary-flow.md`,
  `docs/architecture/secretary-format-interfaces.md`,
  `docs/analysis/shadow-twin-metadata-to-secretary-context.md`,
  `docs/composite-multi-image-e2e.md` (PR #294),
  plus weitere `docs/**` mit `secretary`-Erwaehnung.

### Schritt 1 — Inventur

File: [`01-inventory.md`](./01-inventory.md) **existiert bereits**
(IDE-Agent Pre-Flight).

### Schritt 2 — Contracts

- Neue Rule: `.cursor/rules/secretary-contracts.mdc`
- Globs: `["src/lib/secretary/**/*.ts"]`
- `alwaysApply: true` (analog `shadow-twin-contracts.mdc` und
  `ingestion-contracts.mdc`).
- Mindestens definieren:
  - **§1 Determinismus**: pure Helper sind seiteneffekt-frei
    (`extract-audio-text`, `response-parser`, geplante neue Helper).
    `client.ts`-Funktionen sind I/O-Operationen, NICHT pure.
  - **§2 Fehler-Semantik**: kein silent fallback. HTTP-Fehler ergeben
    `SecretaryServiceError`. Das eine Token-Persist-`catch {}` (E5)
    bekommt expliziten Vertrag (Logging + Kommentar).
  - **§3 Erlaubte/verbotene Abhaengigkeiten**: DARF abhaengen von
    `src/lib/utils/fetch-with-timeout`, `src/lib/env`. DARF NICHT
    abhaengen von `src/components/**`, `src/app/**` (UI), DARF NICHT
    `localStorage` direkt benutzen — das ist UI-State (Audit-Watchpoint
    Zeile 720-721 dokumentiert).
  - **§4 Skip-/Default-Semantik**: was passiert bei leerem
    `extractionMethod`, fehlendem `targetLanguage`, fehlender
    `apiKey`? Verhalten festschreiben.
  - **§5 Streaming-Vertrag**: Server-Sent-Events / Chunked Responses
    haben definierten Lese-Vertrag.
  - **§6 Externer-Service-Vertrag**: Wrapper aendert NIE die
    externen Vertraege. Nderungen am externen Service sind Folge-
    Initiative.

### Schritt 3 — Characterization Tests

**Mindestens 2 neue Test-Files**, eines pro untestetem grossen
Quell-File:

| Test-File | Testet | Mindest-Tests |
|---|---|---:|
| `tests/unit/secretary/client-pdf.test.ts` | `transformPdf`, `transformImage` | 4 (happy, mock-fail, missing-config, streaming) |
| `tests/unit/secretary/client-audio-video.test.ts` | `transformAudio`, `transformVideo`, `extractTextFromUrl` | 4 |
| `tests/unit/secretary/client-session.test.ts` | `processSession`, `importSessionFromUrl`, `embedTextRag` | 3 |
| `tests/unit/secretary/adapter.test.ts` | `callPdfProcess`, `callTemplateTransform`, `callTextTranslate`, `callTransformerChat`, `callTemplateExtractFromUrl` | 5 (1 je Adapter) |

Optional: `client-helpers.test.ts` fuer extrahierte pure Helper.

**Mocks**: alle `fetch`-Calls sauber gemockt. Keine Live-Calls.
Beispiel:

```ts
vi.mock('@/lib/utils/fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
}));
vi.mock('@/lib/env', () => ({
  getSecretaryConfig: () => ({ url: 'http://test.invalid', apiKey: 'k' }),
}));
```

### Schritt 4 — Altlast-Pass

**Pflicht-Subset** (konservativ, analog Welle 1.3):

1. **`catch {}` in `client.ts:731` fixen** (siehe E5).
2. **Pure Helper aus `client.ts` extrahieren** in
   `src/lib/secretary/client-helpers.ts`:
   - Token-Refresh-Logik (Body-Parsing der Auth-Response)
   - FormData-Builder
   - URL-Builder
   - mind. 2-3 Helper, je nach was sich anbietet
3. **Cross-Modul-Test verschieben**: `process-video-job-defaults.test.ts`
   nach `tests/unit/api/secretary/` (analog wo PR #294 die Composite-
   Tests hingelegt hat).
4. **`localStorage`-Direktzugriff**: dokumentieren, evtl. via
   Callback-Parameter abstrahieren — falls trivial. Sonst Watchpoint
   fuer Welle 3.

**NICHT in dieser Welle**:

- Vollstaendiger Split von `client.ts` nach Endpunkt-Typ — Folge-PR.
- Strangler-Fig zwischen `client.ts` und `adapter.ts` — siehe E3.
- UI-Komponenten von direkten `secretary`-Imports loesen — Welle 3.

### Schritt 5 — Strangler-Fig

Entfaellt fuer `secretary` — Default-Annahme: `client.ts` und
`adapter.ts` sind unterschiedliche Layer (high vs. low). Falls Audit
Schritt 0 anders ergibt: hier dokumentieren.

### Schritt 6 — Dead-Code

- `pnpm knip` laufen lassen
- Findings in `src/lib/secretary/`-Modulgrenzen pruefen
- **Vor jeder Loeschung**: User-Frage analog Welle 1.3, weil kein
  Pre-Flight-Beleg fuer toten Code vorliegt.
- Audit-Findings mit Status `delete`/`archive` aus Schritt 0 hier
  umsetzen.

### Schritt 7 — Abnahme

Du fuellst BEIDE DoD-Teile (R5):

**Methodik-DoD**:

- Alle 6 Doku-Files vorhanden (`00-audit.md` bis `06-acceptance.md`).
- `secretary-contracts.mdc` existiert.
- Char-Tests existieren (mind. 15 neue, idealerweise 20-25).

**Modul-DoD** (in DIESER Welle erreichbar):

- `pnpm test` gruen
- `pnpm lint` ohne neue Errors
- `pnpm health -- --module secretary` zeigt:
  - Files: 7 + 1-3 (Helper) = 8-10
  - Max-Zeilen: < 800 (durch Helper-Extracts; Stretch < 600)
  - > 200 Zeilen: 2-3 (Pflicht); Stretch 1
  - leere Catches: **0** (war 1 — Pflicht-Fix)
  - `any`: 0 (unveraendert)

## Push-Strategie (R1, R4)

**Du PUSHST NICHT auf master.** Stattdessen:

- Branch: `refactor/secretary-welle-2` (vom Pre-Flight-Branch
  `cursor/refactor-secretary-preflight-2348` aus, oder eigener neuer
  Branch).
- Commit pro Schritt (`secretary(audit): ...`,
  `secretary(contracts): ...`, `secretary(tests): ...`,
  `secretary(altlast): ...`, etc.).
- 1 PR am Ende — User reviewt, mergt selbst nach lokaler Verifikation
  (R3 — User-UI-Smoke gemaess `05-user-test-plan.md`).
- `[skip ci]` fuer Doku-only-Commits.
- Mindestens 6 Min Abstand zum vorherigen Merge auf master (R4).

## Stop-Bedingungen

Stoppe und melde dem User, wenn:

- `> 1.000 Zeilen Diff` in einem Commit
- Tests werden rot und du findest die Ursache nicht in 30 Min
- Architektur-Frage auftritt, die nicht im Brief geklaert ist
  (insbesondere E3-Frage `client.ts` vs `adapter.ts`)
- Live-Aufrufe an den echten Secretary-Service werden noetig — verboten
- knip findet > 5 unklare unused-Files — User-Frage statt eigenmaechtiges Loeschen
- Externer Secretary-Service-Vertrag muesste geaendert werden — STOP
  (siehe E1)
