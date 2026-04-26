# Inventur: Modul `storage`

Stand: 2026-04-26. Erstellt vom IDE-Agenten als Pre-Flight fuer Welle 1 (siehe `AGENT-BRIEF.md`).
Quelle: `pnpm health --module storage` plus manuelle Test- und API-Route-Zuordnung.

## 1. Modul-Health-Zusammenfassung

| Modul | Files | Max-Zeilen (Datei) | > 200 Zeilen | hat Tests | any | leere catch{} | use client |
|---|---:|---|---:|---|---:|---:|---:|
| `storage` | 15 | 2.109 (`onedrive-provider.ts`) | 9 | ja | 0 | 1 | 0 |

> Cloud-Agent-Verifikation 2026-04-26 (Welle 1, Schritt 1):
> `pnpm health -- --module storage` reproduziert die Werte 1:1
> (15 Files, 2109 Max-Zeilen, 9 > 200, 0 any, 1 leere Catches, 0 'use client').

**Vergleich zu `external-jobs`** (Pilot): strukturell deutlich sauberer
(0 `any`, nur 1 leeres Catch, 0 `use client`). Hauptlast ist die Groesse
weniger Dateien, nicht die Verteilung von Code-Smells.

## 2. Files in `src/lib/storage/`

Sortiert nach Zeilen, absteigend.

| Datei | Zeilen | leere Catches | hat Test |
|---|---:|---:|---|
| onedrive-provider.ts | 2.109 | 1 | nein ← Hauptlast, vergleichbar mit altem `phase-template.ts` |
| storage-factory.ts | 766 | 0 | nein |
| filesystem-provider.ts | 466 | 0 | nein |
| nextcloud-provider.ts | 393 | 0 | nein (aber `nextcloud-provider-url.test.ts` testet URL-Helper) |
| filesystem-client.ts | 309 | 0 | nein |
| storage-factory-mongodb.ts | 308 | 0 | nein |
| shadow-twin.ts | 286 | 0 | nein |
| types.ts | 219 | 0 | nein (Typen, brauchen keinen Test) |
| onedrive-provider-server.ts | 207 | 0 | nein |
| provider-request-cache.ts | 100 | 0 | **ja** |
| server-provider.ts | 87 | 0 | nein |
| request-deduplicator.ts | 86 | 0 | nein |
| shadow-twin-folder-name.ts | 67 | 0 | **ja** |
| supported-types.ts | 39 | 0 | nein |
| non-portable-media-url.ts | 21 | 0 | **ja** |

Plus zwei Tests fuer Helper, die nicht direkt in `src/lib/storage/` liegen:
- `tests/unit/storage/filesystem-zip-extract-capability.test.ts`
- `tests/unit/storage/shadow-twin-find-markdown-dot-basename.test.ts`

**Test-Coverage**: 3-5 von 15 Files direkt getestet (≈25 %). **Die zwei
groessten Provider-Files (onedrive, filesystem, nextcloud) haben keinen
direkten Test** — Hauptkandidaten fuer Char-Tests in Schritt 3.

## 3. API-Routen `src/app/api/storage/`

| Route | Funktion |
|---|---|
| `route.ts` | Generischer Storage-Einstiegspunkt |
| `filesystem/route.ts` | Filesystem-Backend Proxy |
| `nextcloud/route.ts` | Nextcloud-Backend Proxy |
| `streaming-url/route.ts` | Streaming-URLs fuer Binaeranfragen |

## 4. Zentrale Architektur-Rule

[`.cursor/rules/storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc)
(151 Zeilen) ist die Hauptquelle der Wahrheit. Sie ist `alwaysApply: true`
und sehr ausfuehrlich. Inhalt: 6 Regeln, ASCII-Architektur-Diagramm,
Beispiele (verboten/richtig). **Status fuer Audit: vermutlich `keep`** —
Cloud-Agent prueft im Schritt 0.

## 5. Bekannte UI/Storage-Branches (sollten via Welle 1 in Service-Layer wandern)

Plan-Hinweis (Sektion 1 + 9d): Direkte Storage-Typ-Abfragen in UI/Service-Code
sind **Verstoesse gegen die `storage-abstraction.mdc`-Rule** und gehoeren in
den `storage`-Modul-Helper.

Bekannter Hot-Spot:
- [`src/components/library/file-preview.tsx:1134`](../../../src/components/library/file-preview.tsx) → `st.primaryStore === 'filesystem' || st.persistToFilesystem`

Weitere Verdachtsfaelle (Cloud-Agent verifiziert via `rg "library\.type ===|primaryStore"` als Teil von Schritt 1):
- `src/components/creation-wizard/creation-wizard.tsx`
- `src/lib/transform/transform-service.ts`
- `src/app/api/library/[libraryId]/shadow-twins/sync-all/route.ts` u.a.

**Wichtig**: Vollstaendiges Aufraeumen dieser Branches ist **NICHT** Pflicht
fuer Welle 1 — gehoert teilweise in Welle 9d (`file-preview`-Welle). In
Welle 1 wird der **Helper bereitgestellt** und der **Hot-Spot in
file-preview.tsx:1134** als Pilot-Migration umgesetzt.

## 6. Hot-Spots fuer Plan-Schritt 4 (Altlast-Pass)

| Hot-Spot | Datei(en) | Massnahme |
|---|---|---|
| **Datei > 200 Zeilen, sehr gross** | `onedrive-provider.ts` (2.109) | Sub-Module nach Verantwortung: Auth, ItemOps, BinaryOps, Cache, ErrorHandling. Mind. 5 Sub-Files |
| **Datei > 200 Zeilen, gross** | `storage-factory.ts` (766) | Trennung Client- vs. Server-Factory, Provider-Map separat |
| **Datei > 200 Zeilen, mittel** | `filesystem-provider.ts` (466), `nextcloud-provider.ts` (393), `filesystem-client.ts` (309), `storage-factory-mongodb.ts` (308), `shadow-twin.ts` (286) | Pro Datei pruefen ob Split sinnvoll oder ob Datei kohaerent ist. Konservativ mit Split. |
| **Silent Fallback** | `onedrive-provider.ts` (1 leeres Catch) | Untersuchen: dokumentieren oder beheben |
| **UI/Storage-Branches** | `file-preview.tsx:1134` | Pilot-Migration in Service-Helper |

## 7. Hot-Spots fuer Plan-Schritt 3 (Characterization Tests)

Pilot-Fokus: `onedrive-provider.ts` (Hauptlast, kein Test).

Geplante Test-Files (Vorschlag, Cloud-Agent verfeinert):
- `tests/unit/storage/onedrive-provider-list-items.test.ts`
- `tests/unit/storage/onedrive-provider-binary.test.ts`
- `tests/unit/storage/onedrive-provider-error-paths.test.ts`

Hinweis: Onedrive ruft Microsoft Graph API. Mocks sauber via `vi.mock('msal-...')`
oder lokale Fake-Provider erstellen.

## 8. Bekannte Risiken / Watchpoints

- **`StorageFactory` Singleton** — Tests muessen Singleton-State pro Test
  zuruecksetzen (Setup/Teardown).
- **Zwei OneDrive-Implementierungen** (`onedrive-provider.ts` + `onedrive-provider-server.ts`):
  Pre-Flight-Analyse 2026-04-26 hat geklaert: `onedrive-provider-server.ts` ist
  **kein Strangler-Fig**, sondern eigenstaendiger OAuth-Server-Helper (genau
  1 Aufrufer in `src/app/api/auth/onedrive/callback/route.ts`, implementiert
  `StorageProvider` NICHT). → in Schritt 4 nach `src/lib/storage/onedrive/oauth-server.ts`
  umziehen.
- **`storage-factory-mongodb.ts`** — Pre-Flight-Analyse 2026-04-26 hat geklaert:
  **toter Duplikat-Code** (0 Imports im `src/`-Tree, eigene veraltete
  `LocalStorageProvider`-Klasse mit fehlerhaften API-Pfaden, unterstuetzt nur
  `local`). → in Schritt 6 loeschen, knip bestaetigt.
- **API-Route `streaming-url/route.ts`** ist nicht im Audit-Check der Pilot-Welle
  enthalten gewesen — Cloud-Agent verifiziert ob noch genutzt.
