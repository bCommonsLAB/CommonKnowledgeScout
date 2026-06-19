# Analyse: Parameter-Verlust bei Library Export/Import

Stand: 2026-06-18 — ausgeloest durch `library-tamera-2026-06-18.json`
(Produktiv-Export einer Nextcloud-Library, beim Import gingen wichtige
Parameter verloren).

## 1. Symptom

Eine im Produktivsystem exportierte Library wird lokal importiert. Nach dem
Import fehlen "die wichtigsten Parameter". Bei der Tamera-Library (Typ
`nextcloud`) betrifft das vor allem die Storage-Verbindung — die importierte
Library kann ihr Archiv nicht oeffnen.

## 2. Ursache — Allow-List-Drift in Export UND Import

Export und Import bauen die Config NICHT generisch, sondern ueber eine
**fest verdrahtete Feld-Auswahl** (Allow-List). Diese Liste wurde nie
nachgezogen, als neue Config-Felder dazukamen. Felder ausserhalb der Liste
fallen **stillschweigend** weg — ein Verstoss gegen `no-silent-fallbacks.mdc`
und die Checkliste in `library-config-field.mdc`.

Belege:

- Export: `src/app/api/libraries/[id]/export/route.ts` (Z. 63-106)
- Import: `src/app/api/libraries/import/route.ts` (Z. 52-99)
- Vollstaendiges Schema: `StorageConfig` in `src/types/library.ts` (Z. 242-459)
- Was der normale Lese-Pfad an den Client gibt: `toClientLibraries()` in
  `src/lib/services/library-service.ts` (Z. 464-595) — deutlich mehr Felder
  als der Export.

## 3. Feld-fuer-Feld-Abgleich (StorageConfig)

| Config-Feld | Export | Import | Bewertung |
|---|---|---|---|
| `secretaryService` (template, llmModel, targetLanguage, pdfExtractionMethod, …) | ja (ohne apiKey) | ja (ohne apiKey) | OK |
| `ingestionStorage.containerName` | ja (ohne connectionString) | ja | OK |
| `chat` (gallery, facets, embeddings, models) | ja | ja | OK |
| `creation` | ja | ja | OK |
| `publicPublishing` (ohne apiKey) | ja | ja | OK |
| `nextcloud.webdavUrl` + `username` | **nein** | **nein** | **Verlust** (kein Secret!) |
| `nextcloud.appPassword` | nein | nein | korrekt (Secret) |
| `shadowTwin` | **nein** | **nein** | **Verlust** |
| `translations` | **nein** | **nein** | **Verlust** |
| `divaArchiveDefaults` | **nein** | **nein** | **Verlust** |
| `analyzeDivaTextureInfo` | **nein** | **nein** | **Verlust** |
| `autoApplyConfidenceThreshold` | **nein** | **nein** | **Verlust** |
| `clientId` / `clientSecret` / `tenantId` / `redirectUri` / `scope` (OAuth) | nein | nein | korrekt (Secret/host-spezifisch) |

### Wichtigster Treffer fuer Tamera (Typ `nextcloud`)

`nextcloud.webdavUrl` und `nextcloud.username` sind **keine Secrets** — der
Lese-Pfad `toClientLibraries()` liefert sie regulaer an den Client (nur
`appPassword` wird maskiert, Z. 563-581). Der Export wirft jedoch den ganzen
`nextcloud`-Block weg. Ergebnis: Die importierte Library kennt ihren Server
und Benutzer nicht mehr und kann das Archiv nicht auflisten.

## 4. Loesungsvarianten

### Variante A — Allow-List in Export/Import vervollstaendigen (minimal)

Die fehlenden, nicht-geheimen Felder explizit in beide Routen aufnehmen:
`nextcloud` (webdavUrl + username, **ohne** appPassword), `shadowTwin`,
`translations`, `divaArchiveDefaults`, `analyzeDivaTextureInfo`,
`autoApplyConfidenceThreshold`.

- Pro: kleinster Eingriff, leicht zu reviewen.
- Contra: Drift-Problem bleibt — beim naechsten neuen Config-Feld passiert
  dasselbe wieder. Verstoesst gegen den Geist von `no-silent-fallbacks`.

### Variante B — Deny-List statt Allow-List (empfohlen)

Export kopiert die **komplette** `config`, entfernt nur eine zentral
gepflegte Liste von Secret-Feldern (`secretaryService.apiKey`,
`ingestionStorage.connectionString`, `publicPublishing.apiKey`,
`nextcloud.appPassword`, `clientSecret`). Import uebernimmt die komplette
`config` 1:1 und setzt nur Secrets/`useCustomConfig` zurueck.

- Pro: neue Config-Felder sind automatisch round-trip-sicher; eine einzige
  Secret-Liste als Single Source of Truth; passt zu `library-config-field.mdc`.
- Contra: Secret-Liste muss diszipliniert gepflegt werden (zentral, getestet).

### Variante C — Gemeinsame Sanitizer-Funktion + Unit-Test

Wie B, aber die Secret-Maskierung wird in eine geteilte Funktion
(`sanitizeLibraryConfigForExport`) ausgelagert, die Export und Import
gemeinsam nutzen. Ein Unit-Test verifiziert den Round-Trip
(`config` → export → import → `config'`) und schlaegt fehl, sobald ein neues
Feld nicht abgedeckt ist.

- Pro: dauerhaft drift-sicher durch Test; sauberste Architektur.
- Contra: groesster Aufwand (neue lib-Funktion + Test).

## 5. Entscheidung & Umsetzung (2026-06-19)

Gewaehlt: **Variante B**. Umgesetzt in:

- `src/lib/library/config-export.ts` — neue zentrale Helfer:
  - `stripLibraryConfigSecrets(config)` (Deny-List, fuer Export)
  - `prepareImportedLibraryConfig(config)` (Deny-List + Reset von
    `useCustomConfig`, fuer Import)
- `src/app/api/libraries/[id]/export/route.ts` — uebernimmt die komplette
  `config` und entfernt nur Secrets.
- `src/app/api/libraries/import/route.ts` — uebernimmt die komplette `config`
  1:1 (Secrets defensiv entfernt).

Single Source of Truth fuer Secrets: `clientSecret`, `nextcloud.appPassword`,
`secretaryService.apiKey`, `ingestionStorage.connectionString`,
`publicPublishing.apiKey`. Alle anderen Felder sind ab sofort automatisch
round-trip-sicher.

## 6. Hinweis: Storage-Secret bleibt immer nachzutragen

Unabhaengig von der Variante muss das Nextcloud-`appPassword` (bzw. OAuth-
`clientSecret`) nach dem Import neu eingegeben werden — Secrets werden
bewusst nicht exportiert. Mit Variante B/C sind aber `webdavUrl` + `username`
vorausgefuellt, sodass nur noch das App-Passwort fehlt.
