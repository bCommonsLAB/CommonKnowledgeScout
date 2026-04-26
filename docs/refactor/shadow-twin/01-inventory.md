# Inventur: Modul `shadow-twin`

Stand: 2026-04-27. Erstellt vom Cloud-Agent als Teil von Welle 2
(siehe [`AGENT-BRIEF.md`](./AGENT-BRIEF.md)).

Quelle: `pnpm health -- --module shadow-twin` plus manuelle Test- und
Cross-Modul-Zuordnung.

## 1. Modul-Health-Zusammenfassung

| Modul | Files | Max-Zeilen (Datei) | > 200 Zeilen | hat Tests | any | leere catch{} | use client |
|---|---:|---|---:|---|---:|---:|---:|
| `shadow-twin` | 30 | 915 (`store/shadow-twin-service.ts`) | 12 | ja | 0 | 0 | 0 |

**Vergleich zu `storage`** (Welle 1): strukturell aehnlich sauber, aber
deutlich groessere Test-Coverage (13 Char-Tests vs. 6 in storage). Hauptlast
ist die Groesse einiger Files, nicht Code-Smells.

## 2. Files in `src/lib/shadow-twin/`

Sortiert nach Zeilen, absteigend.

| Datei | Zeilen | hat direkten Test |
|---|---:|---|
| store/shadow-twin-service.ts | 914 | **ja** (`shadow-twin-service.test.ts`) |
| analyze-shadow-twin.ts | 465 | nein |
| shadow-twin-migration-writer.ts | 458 | nein |
| shadow-twin-mongo-writer.ts | 433 | teilweise (`shadow-twin-mongo-writer-rewrite.test.ts`) |
| artifact-client.ts | 422 | nein |
| media-persistence-service.ts | 352 | nein (aber `media-storage-strategy.test.ts` testet die Strategie-Logik) |
| shadow-twin-direct-upload.ts | 266 | nein |
| artifact-writer.ts | 233 | **ja** |
| artifact-naming.ts | 229 | **ja** |
| artifact-resolver.ts | 224 | **ja** |
| store/mongo-shadow-twin-store.ts | 205 | **ja** |
| shared.ts | 203 | nein (Typen + Helper) |
| media-storage-strategy.ts | 161 | **ja** |
| store/provider-shadow-twin-store.ts | 156 | nein |
| store/shadow-twin-store.ts | 140 | nein (Interface) |
| conversion-job-utils.ts | 132 | **ja** |
| reconstruct-from-storage.ts | 127 | nein |
| conversion-job.ts | 117 | nein |
| migrate-document-images.ts | 107 | nein |
| artifact-logger.ts | 106 | nein |
| artifact-types.ts | 79 | nein (Typen) |
| mongo-shadow-twin-id.ts | 73 | **ja** |
| shadow-twin-select.ts | 61 | **ja** |
| mongo-shadow-twin-item.ts | 59 | nein |
| binary-fragment-lookup.ts | 58 | **ja** |
| shadow-twin-mongo-client.ts | 51 | nein |
| errors.ts | 40 | nein |
| shadow-twin-config.ts | 38 | nein |
| mode-helper.ts | 28 | nein |
| mode-client.ts | 24 | nein |

**Test-Coverage**: 11 von 30 Files direkt getestet (~37 %). Plus
zwei indirekte Tests in `tests/unit/storage/` und mehrere Cross-Modul-Tests
in `external-jobs`, `gallery`, `media`, `testimonials`. **Die zwei
groessten ungetesteten Files** (`analyze-shadow-twin.ts`,
`shadow-twin-migration-writer.ts`, `artifact-client.ts`) sind
Hauptkandidaten fuer Char-Tests in Welle-Schritt 3.

## 3. Tests in `tests/unit/shadow-twin/`

13 Test-Files (alle als `keep` zu erwarten, Audit verifiziert):

| Test-File | Zeilen | Testet |
|---|---:|---|
| `artifact-naming.test.ts` | — | `artifact-naming.ts` (deterministische Pfad-/Name-Bildung) |
| `artifact-resolver.test.ts` | — | `artifact-resolver.ts` (ArtifactKey -> Item) |
| `artifact-writer.test.ts` | — | `artifact-writer.ts` (Persistenz-Wrapper) |
| `binary-fragment-lookup.test.ts` | — | `binary-fragment-lookup.ts` |
| `conversion-job-utils.test.ts` | — | `conversion-job-utils.ts` |
| `freeze-markdown-image-urls.test.ts` | — | Cross-Modul-Test (Markdown-Image-URLs einfrieren) |
| `media-storage-loop.test.ts` | — | Race-Condition-Test fuer Media-Persistierung |
| `media-storage-strategy.test.ts` | — | `media-storage-strategy.ts` (Auswahl Azure vs. Filesystem) |
| `mongo-shadow-twin-id.test.ts` | — | `mongo-shadow-twin-id.ts` (virtuelle ID-Konvention) |
| `mongo-shadow-twin-store.test.ts` | — | `store/mongo-shadow-twin-store.ts` |
| `shadow-twin-mongo-writer-rewrite.test.ts` | — | Aspekt von `shadow-twin-mongo-writer.ts` (Rewrite-Logik) |
| `shadow-twin-select.test.ts` | — | `shadow-twin-select.ts` |
| `shadow-twin-service.test.ts` | — | `store/shadow-twin-service.ts` (Hauptlast) |

Plus zwei Cross-Modul-Tests in `tests/unit/storage/`:
- `shadow-twin-find-markdown-dot-basename.test.ts`
- `shadow-twin-folder-name.test.ts`

## 4. Zentrale Architektur-Rule

[`.cursor/rules/shadow-twin-architecture.mdc`](../../../.cursor/rules/shadow-twin-architecture.mdc)
ist die Hauptquelle der Wahrheit. Status:

- `alwaysApply: false`, aber an pipeline-Globs gebunden.
- Inhalt: ArtifactKey-Determinismus, Storage-Abstraktion, Mongo-virtuelle
  IDs, ShadowTwinState-Interface, API-Design.
- **Status fuer Audit: vermutlich `keep`** — Cloud-Agent prueft im
  Schritt 0.

Verwandte Rules:
- `contracts-story-pipeline.mdc` (alwaysApply: false) — globaler
  Pipeline-Contract, deckt shadow-twin-Bezug ab.
- `media-lifecycle.mdc` — Persistenz/Lifecycle von Binary-Fragments.

## 5. Hot-Spots fuer Welle 2

### 5.1 Files > 200 Zeilen ohne direkten Test

| Datei | Zeilen | Vorschlag |
|---|---:|---|
| `analyze-shadow-twin.ts` | 465 | Char-Tests fuer Decision-Funktionen (Welle-Schritt 3) |
| `shadow-twin-migration-writer.ts` | 458 | Char-Tests fuer Migration-Pfade (Welle-Schritt 3) |
| `artifact-client.ts` | 422 | Char-Tests fuer HTTP-Client-Vertraege (Welle-Schritt 3) |
| `media-persistence-service.ts` | 352 | Char-Tests fuer kritische Pfade (Welle-Schritt 3) |
| `shadow-twin-direct-upload.ts` | 266 | opportunistisch |

### 5.2 Files > 200 Zeilen mit Test (potenzielle Splits, nicht Pflicht)

| Datei | Zeilen | Anmerkung |
|---|---:|---|
| `store/shadow-twin-service.ts` | 914 | Hauptlast; **Char-Test existiert** (sichert Verhalten); Split potenziell sinnvoll, aber invasive Bewegung -> Folge-PR |
| `shadow-twin-mongo-writer.ts` | 433 | rewrite-Aspekt getestet; weiterer Test-Bedarf |
| `artifact-writer.ts` | 233 | Test existiert, knapp ueber Schwelle, Split unkritisch |
| `artifact-naming.ts` | 229 | Test existiert, knapp ueber Schwelle |
| `artifact-resolver.ts` | 224 | Test existiert, knapp ueber Schwelle |
| `store/mongo-shadow-twin-store.ts` | 205 | Test existiert |
| `shared.ts` | 203 | Typen + Helper, Split risikoreich |

## 6. Bekannte Risiken / Watchpoints

- **`shadow-twin-service.ts` ist 914 Zeilen** — kann nicht in einem Cloud-Agent-Lauf
  vollstaendig gesplittet werden ohne Char-Test-Crash-Risiko. Pragmatischer
  Ansatz fuer Welle 2: pure Helper extrahieren (analog `onedrive/errors.ts`
  in Welle 1), Hauptklasse als Composer/Fassade belassen.
- **`shadow-twin-architecture.mdc`** ist `alwaysApply: false`, an pipeline-Globs
  gebunden. Eine modul-spezifische `shadow-twin-contracts.mdc` muss komplementaer
  sein, nicht doppelt.
- **`store/`-Unterordner** ist bereits als Interface + 2 Implementierungen
  strukturiert (`MongoShadowTwinStore`, `ProviderShadowTwinStore`) — guter
  Stand, kein Refactor noetig.
- **Mongo-Shadow-Twin-IDs** (virtuelle IDs) sind Vertragsbestandteil
  (`shadow-twin-architecture.mdc`); muss in `shadow-twin-contracts.mdc`
  als technischer Contract verankert werden.
- **Live-Mongo/Azure-Calls in Tests sind verboten** (siehe AGENTS.md);
  saubere Mocks sind Pflicht.
