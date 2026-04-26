# Bestands-Audit: Modul `storage`

Stand: 2026-04-26. Erstellt vom Cloud-Agent (Welle 1, Plan-Schritt 0).

Bezug:
- [`AGENT-BRIEF.md`](./AGENT-BRIEF.md) Schritt 0
- [`01-inventory.md`](./01-inventory.md) (Pre-Flight, IDE-Agent)
- [`docs/_analysis/storage-pre-flight-2026-04-26.md`](../../_analysis/storage-pre-flight-2026-04-26.md)
  (zwei Vorab-Entscheidungen aus dem Pre-Flight, hier nur bestaetigt)
- Pilot-Vorlage: [`docs/refactor/external-jobs/00-audit.md`](../external-jobs/00-audit.md)

## Zusammenfassung

| Bereich | Eintraege | keep | update | merge | migrate | delete | archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor Rules | 6 | 4 | 1 | 0 | 0 | 0 | 0 |
| Tests | 6 | 6 | 0 | 0 | 0 | 0 | 0 |
| Docs | 5 | 1 | 1 | 0 | 0 | 0 | 3 |
| **Summe** | **17** | **11** | **2** | **0** | **0** | **0** | **3** |

**Kritische Findings**:

- Modul-Architektur-Rule [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc)
  ist `alwaysApply: true`, ausfuehrlich (151 Zeilen) und unveraendert gueltig.
  Sie wird nicht doppelt gepflegt; die neue `storage-contracts.mdc` setzt
  ergaenzende technische Invarianten (Welle-Schritt 2) und verweist auf sie.
- **Kein Bestands-Test-Drift**: alle 6 Tests in `tests/unit/storage/` und
  zwei Helper-Tests darunter pruefen real existierenden Code mit korrekten
  Vertraegen → Sicherheitsnetz fuer Welle 1.
- **`storage-factory-mongodb.ts` ist toter Code** (Pre-Flight verifiziert,
  0 Imports im `src/`-Tree, eigene veraltete `LocalStorageProvider`-Klasse).
  Reine Bestaetigung, Ausfuehrung in Schritt 6 (Dead-Code).
- **`onedrive-provider-server.ts` ist KEIN Strangler-Fig**, sondern ein
  eingegrenzter OAuth-Server-Helper (Klassenname `OneDriveServerProvider`,
  implementiert `StorageProvider` NICHT, genau 1 Aufrufer in
  `src/app/api/auth/onedrive/callback/route.ts:122`). Wird in Schritt 4
  nach `src/lib/storage/onedrive/oauth-server.ts` umgezogen, nicht aufgeloest.
- **Doku-Drift**: drei `docs/analysis/`-Dateien beschreiben Storage-Strategien
  aus laufenden Diskussionen; keine "Quelle der Wahrheit", aber kein
  Handlungsbedarf in Welle 1. Aktion `archive` nach Welle-Abschluss.

## A. Cursor Rules

In Scope: alle Rules, die explizit `storage-` heissen oder im Body
direkt auf `src/lib/storage/**` verweisen.

| Rule-Datei | Bezug zum Modul | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [.cursor/rules/storage-abstraction.mdc](../../../.cursor/rules/storage-abstraction.mdc) | direkt (Architektur-Rule, `alwaysApply: true`) | aktuell | **keep** | Hauptquelle der Wahrheit fuer Provider-Abstraktion. Inhalt deckt sich mit aktuellem Code (Factory + 3 Provider-Backends). Update-Bedarf nur kosmetisch (Beispiel-Imports), nicht in Welle 1. |
| [.cursor/rules/no-silent-fallbacks.mdc](../../../.cursor/rules/no-silent-fallbacks.mdc) | global, deckt `storage` mit ab | aktuell | **keep** | Direkt relevant fuer Schritt 4: `onedrive-provider.ts:2092` (`} catch {}`) ist exakt der Anti-Pattern-Fall, der dort verboten wird. |
| [.cursor/rules/contracts-story-pipeline.mdc](../../../.cursor/rules/contracts-story-pipeline.mdc) | indirekt (§2 Storage-Abstraktions-Contract) | aktuell | **keep** | Pipeline-Contract bestaetigt: UI darf kein Storage-Backend kennen. Bezug zu Welle 9d (file-preview), nicht Pflicht-Update fuer Welle 1. |
| [.cursor/rules/shadow-twin-architecture.mdc](../../../.cursor/rules/shadow-twin-architecture.mdc) | indirekt (Storage-Abstraktion in Shadow-Twin-System) | aktuell | **keep** | Verweist auf `useStorageProvider()`/`useStorage()`-Hooks; bleibt unveraendert in Welle 1. |
| [.cursor/rules/media-lifecycle.mdc](../../../.cursor/rules/media-lifecycle.mdc) | indirekt (Storage als Persistenz-Layer fuer Medien) | aktuell | **keep** | Erwaehnt `binaryFragments` und Storage-Filesystem als Fallback; kein Update-Bedarf. |
| [.cursor/rules/external-jobs-integration-tests.mdc](../../../.cursor/rules/external-jobs-integration-tests.mdc) | indirekt (Pipeline nutzt Storage-Provider) | aktuell | **update** | Erwaehnt Storage als Quelle fuer Phase 1; minimaler Verweis-Update auf neue `storage-contracts.mdc` empfohlen, **aber nicht Pflicht in Welle 1** — nur falls beim Schreiben der neuen Rule sinnvoll. Kein Code-Bezug. |

### Update-Detail fuer `external-jobs-integration-tests.mdc`

Optional in Schritt 2 (Contracts):

- Footer-Verweis auf `storage-contracts.mdc` ergaenzen (Cross-Reference).
- Falls Schritt 4 die Helper-Funktion `isFilesystemBacked()` einfuehrt,
  dort als bevorzugter Weg dokumentieren statt direktem `library.type`-Check.

Wird in Schritt 2 entschieden; bei Zeitknappheit nicht Pflicht (Audit-Action `update` ist im Sinne von "darf, muss nicht").

### Neu zu erstellen (Schritt 2)

- `.cursor/rules/storage-contracts.mdc` — modul-spezifische Contract-Rule,
  Globs `["src/lib/storage/**/*.ts"]`. **Nicht im Audit gelistet**, weil sie
  in Schritt 2 entsteht.

## B. Tests

In Scope: alle Tests in `tests/unit/storage/` (6 Dateien). Zur Pruefung mit
aufgenommen: `tests/unit/storage/filesystem-zip-extract-capability.test.ts`
(testet `ImageExtractionService` mit Storage-Provider-Mock — Grenzfall, real
ein Transform-Test, aber pflegt Provider-Vertrag).

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion | Begruendung |
|---|---|---|---|---|---|
| [tests/unit/storage/provider-request-cache.test.ts](../../../tests/unit/storage/provider-request-cache.test.ts) | `withRequestStorageCache` aus `src/lib/storage/provider-request-cache.ts` | ja (111 Z.) | ja — prueft Prototype-Preserve + Memoization | **keep** | Sichert Regression aus dokumentiertem Bug ab |
| [tests/unit/storage/nextcloud-provider-url.test.ts](../../../tests/unit/storage/nextcloud-provider-url.test.ts) | `normalizeWebdavUrl` aus `src/lib/storage/nextcloud-provider.ts` | ja (420 Z.) | ja — Whitespace-Trim + Pfad-Encoding | **keep** | Pure Funktion, gut getestet |
| [tests/unit/storage/non-portable-media-url.test.ts](../../../tests/unit/storage/non-portable-media-url.test.ts) | `isAbsoluteLoopbackMediaUrl` aus `src/lib/storage/non-portable-media-url.ts` | ja (20 Z.) | ja — relative vs. localhost vs. Azure | **keep** | Schuetzt Media-URL-Lifecycle (Verbindung zu media-lifecycle-Rule) |
| [tests/unit/storage/shadow-twin-folder-name.test.ts](../../../tests/unit/storage/shadow-twin-folder-name.test.ts) | `buildTwinRelativeMediaRef`, `parseTwinRelativeImageRef`, `generateShadowTwinFolderName`, `shouldFilterShadowTwinFolders` aus `src/lib/storage/shadow-twin-folder-name.ts` | ja (78 Z.) | ja — Twin-Folder-Konventionen | **keep** | Pure Funktionen, vollstaendige Coverage |
| [tests/unit/storage/shadow-twin-find-markdown-dot-basename.test.ts](../../../tests/unit/storage/shadow-twin-find-markdown-dot-basename.test.ts) | `resolveArtifact` aus `src/lib/shadow-twin/artifact-resolver.ts` (mockt `findShadowTwinFolder`) | ja | ja — Edge-Case "Punkt im baseName" | **keep** | Sichert konkreten Bugfix ab |
| [tests/unit/storage/filesystem-zip-extract-capability.test.ts](../../../tests/unit/storage/filesystem-zip-extract-capability.test.ts) | `ImageExtractionService.saveZipArchive` aus `src/lib/transform/image-extraction-service.ts` (Provider-Vertrag mit `saveAndExtractZipInFolder`) | ja | ja — Feature-Detection auf Provider | **keep** | Indirekter Storage-Vertragstest (Provider liefert optionale Methode); gehoert konzeptuell zur `transform`-Welle, schadet aber nicht hier |

### Test-Coverage-Luecke (in Schritt 3 abdecken)

Folgende grosse Files in `src/lib/storage/` haben **keinen direkten Test**:

- `onedrive-provider.ts` (2.108 Z.) ← Welle-1-Hauptziel fuer Char-Tests
- `storage-factory.ts` (801 Z.) ← Char-Test fuer Provider-Auswahl je Library-Typ
- `filesystem-provider.ts` (475 Z.) — opportunistisch, nicht Pflicht
- `nextcloud-provider.ts` (420 Z., URL-Helper getestet) — opportunistisch
- `filesystem-client.ts` (328 Z.) — opportunistisch
- `storage-factory-mongodb.ts` (331 Z.) — entfaellt in Schritt 6 (Loeschung)
- `shadow-twin.ts` (285 Z.) — opportunistisch
- `onedrive-provider-server.ts` (212 Z.) — wird in Schritt 4 umgezogen; Test
  ist Folge-PR

Schritt 3 fokussiert auf `onedrive-provider.ts` (3+ Test-Files) und
`storage-factory.ts` (1 Test-File mit Provider-Auswahl).

## C. Docs

In Scope: alle Files in `docs/`, die "storage" im Pfad oder als primaeres
Thema haben. Querreferenzen aus anderen Modulen sind out of scope.

| Doc-Datei | Beschreibt was | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [docs/reference/modules/storage.md](../../reference/modules/storage.md) | Modul-Referenz mit Key-Files, Exports, Architektur | teilweise veraltet | **update** | (a) Listet `MongoDBStorageFactory` als Export und beschreibt sie als "MongoDB-based factory" — nach Loeschung in Schritt 6 muss der Eintrag raus. (b) "Nextcloud: In development" stimmt nicht mehr — Nextcloud ist produktiv (Provider + Tests). (c) Update wird in Schritt 6 zusammen mit Loeschung gemacht (Doku-Hygiene), nicht in Schritt 2. |
| [docs/analysis/storage.md](../../analysis/storage.md) | Storage-Architektur-Analyse | unbekannt (nicht gelesen, Audit-Hinweis) | **archive** | Per Convention `docs/analysis/*` = laufende Diskussion / Snapshot. Nach Welle 1 in `docs/_analysis/` verschieben (analog Pilot). Bis dahin: keep, weil moeglicher Hintergrund fuer Architektur-Entscheidungen in Schritt 4. |
| [docs/analysis/integration-tests-storage-agnostic.md](../../analysis/integration-tests-storage-agnostic.md) | Diskussion Storage-agnostische Integration-Tests | unbekannt | **archive** | Wie oben. Inhalt ist Diskussions-Snapshot, kein normativer Reference-Doc. |
| [docs/analysis/shadow-twin-storage-abstraction.md](../../analysis/shadow-twin-storage-abstraction.md) | Storage-Abstraktion im Shadow-Twin-Kontext | unbekannt | **archive** | Wie oben. Inhalt ist im `shadow-twin-architecture.mdc`-Rule und `storage-abstraction.mdc` bereits normativ verankert. |
| [docs/_analysis/storage-pre-flight-2026-04-26.md](../../_analysis/storage-pre-flight-2026-04-26.md) | Pre-Flight fuer Welle 1 (Mongo-Factory + OneDrive-Server) | aktuell | **keep** | Bereits unter `_analysis/` (per Naming-Konvention historisch). Bleibt als Beleg fuer Schritt-0/4/6-Entscheidungen. |

### Out of Scope

Andere Files erwaehnen Storage nur als Querreferenz und sind primaer einem
anderen Modul zugeordnet (Welle-Modul in Klammern):

- `docs/architecture/pipeline-phases.md` — external-jobs / pipeline
- `docs/architecture/dependency-graph.md` — meta
- `docs/architecture/module-hierarchy.md` — meta (Loeschung des Verweises auf
  `storage-factory-mongodb.ts` in Schritt 6 mitzieht)
- `docs/reference/file-index.md` — meta (siehe oben)
- `docs/use-cases/library-setup.md` — library-Welle
- `docs/guides/shadow-twin.md` — shadow-twin-Welle
- `docs/_chats/*`, `docs/_analysis/*` — historische Notizen, per Naming-Konvention
  archiviert
- `docs/media-lifecycle-architektur.md` — media-lifecycle-Welle

## Audit -> Folge-Schritte

| Audit-Aktion | Folge-Schritt | Wo umgesetzt | In Welle 1? |
|---|---|---|---|
| Rule `storage-contracts.mdc` neu anlegen | Schritt 2 | direkt | **ja** |
| Rule `external-jobs-integration-tests.mdc` -> **update** (optional Cross-Ref) | Schritt 2 | direkt | nice-to-have |
| Tests fuer `onedrive-provider.ts` + `storage-factory.ts` -> **add** | Schritt 3 | direkt | **ja** |
| `onedrive-provider.ts` -> 5 Sub-Module + Fassade | Schritt 4 | direkt | **ja** |
| Silent-Catch in `onedrive-provider.ts:2092` -> dokumentieren / fixen | Schritt 4 | direkt | **ja** |
| `onedrive-provider-server.ts` -> Umzug nach `onedrive/oauth-server.ts` | Schritt 4 | direkt | **ja** |
| Helper `isFilesystemBacked()` einfuehren + Pilot-Migration `file-preview.tsx:1134` | Schritt 4 | direkt | **ja** |
| `storage-factory-mongodb.ts` -> **delete** (Pre-Flight bestaetigt) | Schritt 6 | direkt | **ja** |
| Doc `docs/reference/modules/storage.md` -> **update** (MongoDB-Factory weg, Nextcloud-Status) | Schritt 6 | direkt (Doku-Hygiene) | **ja** |
| Docs `docs/analysis/{storage,integration-tests-storage-agnostic,shadow-twin-storage-abstraction}.md` -> **archive** nach `docs/_analysis/` | Schritt 6 | direkt (Doku-Hygiene) | **ja** |
| Verweise in `docs/architecture/module-hierarchy.md` + `docs/reference/file-index.md` aktualisieren | Schritt 6 | direkt | **ja** |
| Tests fuer `filesystem-provider.ts`, `nextcloud-provider.ts`, `filesystem-client.ts`, `shadow-twin.ts` | spaeter | Folge-PR | nein |

## Architektur-Anmerkung (kein Audit-Eintrag)

Beim Lesen der Provider-Files faellt auf:

- `storage-factory.ts` (801 Z.) enthaelt **drei vollstaendige Provider-Klassen**
  inline (`LocalStorageProvider`, `NextcloudClientProvider`) plus den Import
  fuer `OneDriveProvider`. Eine konsequente Trennung waere:
  `storage/local-client-provider.ts`, `storage/nextcloud-client-provider.ts`,
  `storage/factory.ts` (nur die Factory). Das ist invasive Bewegung und
  **NICHT Pflicht in Welle 1** — gehoert in Folge-PR. Welle 1 begnuegt sich
  mit dem OneDrive-Split (Hauptlast 2.108 Zeilen) plus der Helper-Migration.
- `getProvider()`-`default`-Branch (Zeile 770-786) wirft einen typisierten
  Fehler — gut. Aber die `console.warn` davor verletzt strikt
  `no-silent-fallbacks` (es ist kein Fallback, aber Logging vor Throw ist
  Cargo-Cult). Optional in Schritt 4: `console.warn` raus, `throw` belassen.
