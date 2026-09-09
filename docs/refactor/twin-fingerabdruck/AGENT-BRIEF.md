# Agent-Brief Twin-Fingerabdruck — der Sync-Check liest nur, was sich geändert hat

> Zwischenschnitt, vom Owner am 2026-09-09 zur Umsetzung in einer
> Online-Session freigegeben (siehe `docs/STAND.md`). Kein Teil von M5.
> Mutter-Welle: Shadow-Twin-Sync-Engine (Wellen 5a–5d); dies ist die
> Nachwelle „Fingerabdruck" nach `refactor-naming-konvention.md`.

## Befund (Owner-Log vom 09.09.2026)

Ein `abdeckung_scannen` über das Archiv lässt den Sync-Engine-Check im
Modus `check` laufen. Der lädt **für jede Quelle jede Markdown-Datei ihrer
Twin-Familie vollständig**: alle Transkript-Varianten, alle
Transformations-Slots und alle Geschwister-Dateien mit altem Namen. Je Datei
zwei Anfragen an OneDrive, Dateiinformationen und Inhalt:

| Schritt | Dauer je Datei (Log) |
|---|---|
| Dateiinformationen (`/items/{id}`) | 110–190 ms |
| Inhalt (`/content`) | 180–270 ms |
| gesamt | ~330 ms, unabhängig von der Größe |

Bei einem Vorhaben mit 200 Dateien sind das über eine Minute nur fürs Lesen,
und genau das reißt das 60-Sekunden-Limit der MCP-Brücke (Vorrat: „Job-Modus
für große Scans"). Beispiel aus dem Log: `Huemer_2004_…_c.md` (743 KB) wird
zweimal geladen, einmal als Quelle, einmal als `.pdfanalyse-…`-Artefakt,
gleiche Größe, vermutlich gleicher Inhalt.

**Warum der Check liest:** Die Engine ist für die Reparatur gebaut und
entscheidet inhaltlich („vollständigster gewinnt", Konflikt bei gleichem
Umfang, Frontmatter als Legacy-Signal, Handkorrektur-Vorrang). Das ist
richtig, wenn etwas zu tun ist. Seit das Archiv Mongo-only ist (August 2026),
ist die Antwort aber bei fast jeder Quelle **dieselbe wie beim letzten Lauf**,
und ob sie es ist, steht schon im Ordner-Listing: Name, Größe, Änderungsdatum
und `version` je Datei (`packages/contracts/src/storage-provider.ts`, `StorageItem.metadata`).

## Ziel

Der Check liest den Inhalt einer Twin-Familie nur noch, wenn sich seit dem
letzten Lauf im Storage-Listing oder im Mongo-Dokument etwas geändert hat.
Ein zweiter Lauf über ein unverändertes Archiv macht **null `getBinary`-Aufrufe**
und liefert denselben Report.

Nicht Teil dieser Welle: der Job-Modus (bleibt im Vorrat), Bereichs-Lesen
(`range`) über die Brücke (Storage-Wunschliste Stufe 3), Änderungen an den
Plan-Funktionen (`plan-source-sync.ts` & Co bleiben rein und unverändert).

## Wo es im Code sitzt

| Datei | Was dort passiert |
|---|---|
| `src/lib/shadow-twin/sync-engine/run-library-sync.ts` (Schleife ab Zeile ~89) | je Quelle `collectSourceInput` → `planSourceSync` → Report-Zeile. **Hier kommt das Tor hin.** |
| `src/lib/shadow-twin/sync-engine/collect-source-input.ts` (Zeile ~117) | liest alle Transkript-Varianten (`getBinary` je Datei) |
| `src/lib/shadow-twin/sync-engine/collect-transformations.ts` (Zeile ~85) | liest alle Transformations-Slots |
| `src/lib/shadow-twin/sync-engine/collect-name-migration.ts` (Zeile ~177, Adoptionspfad) | liest legacy-benannte Geschwister, um Frontmatter zu erkennen |
| `src/lib/shadow-twin/sync-engine/folder-cache.ts` | Listing-Cache je Ordner; liefert die `StorageItem`s mit Metadaten, aus denen der Fingerabdruck entsteht |
| `src/lib/shadow-twin/sync-engine/report-types.ts` | `SourceSyncReportRow` — das, was wiederverwendet wird |
| `src/lib/repositories/shadow-twin-repo.ts` (`filesystemSync`, Zeile ~42; Upserts ab ~131) | Mongo-Dokument; hier wird der Fingerabdruck abgelegt |
| `src/lib/agent-view/coverage-service.ts` (Zeile ~84–128), `engine-gaps.ts` | Verbraucher des Check-Reports (Befunde aus `syncReport.sources`) |
| `src/lib/mcp/tools*.ts` (`twins_pruefen`, `abdeckung_scannen`) | Aufrufer über die Brücke; bekommen den Schalter zum Erzwingen |
| `src/lib/storage/onedrive-provider.ts` (`getBinary`, Zeile ~1830; Item-Info-Aufruf ~1988) | Stufe 2: die zweite Anfrage je Datei |

## Stufe 1: Fingerabdruck je Quelle (Pflicht)

**Fingerabdruck.** Aus dem Listing des Twin-Ordners plus den
Geschwister-Dateien mit `{base}.`-Bezug im Elternordner: je Datei `name`,
`size`, `modifiedAt` (ISO) und, wo der Provider sie liefert, `version`.
Sortiert nach Name, als JSON serialisiert, SHA-1 darüber. Dazu die Anzahl
der Dateien, damit ein Report den Unterschied zeigen kann.

**Mongo-Stand.** `updatedAt` des Shadow-Twin-Dokuments. Jeder Schreibweg
(Pipeline-Upsert, Migrations-Writer, Kurations-Patch) setzt es; die
Online-Session prüft das an jedem Upsert in `shadow-twin-repo.ts`, bevor sie
sich darauf verlässt. Setzt ein Weg es nicht, wird das in derselben PR
nachgezogen, nicht umgangen.

**Ablage** im Dokument, neues Feld, nicht `filesystemSync` überladen:

```ts
checkStand?: {
  fingerabdruck: string        // SHA-1 über das Listing
  dateien: number
  mongoUpdatedAt: string       // updatedAt des Dokuments beim letzten Check
  engineVersion: string        // Konstante in run-library-sync.ts; hochzählen bei jeder Plan-Änderung
  geprueftAm: string
  zeile: SourceSyncReportRow   // ohne executed/error (die gibt es im check nicht)
}
```

**Das Tor** in `run-library-sync.ts`, nur im Modus `check`:

1. Listing holen (`folderCache.list(twinFolderId)`, Elternordner ist durch
   `resolveSources` schon im Cache), Fingerabdruck rechnen. **Schlägt das
   Listing fehl, kein Tor**, voller Weg wie heute. Der Fehler bleibt sichtbar
   (`no-silent-fallbacks`).
2. Stimmen `fingerabdruck`, `mongoUpdatedAt` und `engineVersion` mit
   `doc.checkStand` überein und ist `erzwingen` nicht gesetzt: `zeile`
   wiederverwenden, Zähler `report.wiederverwendet++`, **kein**
   `collectSourceInput`.
3. Sonst voller Weg; nach dem Planen `checkStand` schreiben (eine
   `$set`-Operation, eigene Repo-Funktion `setCheckStand`).
4. Modus `repair`: nie wiederverwenden. Nach einer Ausführung `checkStand`
   löschen oder neu setzen, der nächste Check rechnet dann frisch.

**Sichtbarkeit.** `LibrarySyncReport` bekommt `wiederverwendet: number`
und `gelesen: number`; die MCP-Antworten von `twins_pruefen` und
`abdeckung_scannen` geben beides aus. Ein Lauf, der alles wiederverwendet,
ist damit von einem Lauf, der nichts gefunden hat, unterscheidbar.

**Erzwingen.** `runLibrarySync({ ..., erzwingen: true })` umgeht das Tor;
`twins_pruefen` und `abdeckung_scannen` reichen den Schalter durch (Name wie
bei `quelle_erschliessen`: `erzwingen`). Die Werkbank braucht ihn vorerst
nicht.

**Beweise** (`tests/unit/shadow-twin/sync-engine/`, Muster wie
`collect-source-input.test.ts` mit gezähltem `getBinary`):

- zweiter Check mit gleichem Listing und gleichem Mongo-Stand: `getBinary` wird
  **null** Mal aufgerufen, die Report-Zeile ist identisch
- eine Datei im Listing anders (Größe oder `modifiedAt`): voller Weg, `checkStand` neu
- `updatedAt` des Dokuments neuer: voller Weg
- `engineVersion` anders: voller Weg
- Listing schlägt fehl: voller Weg, `checkStand` bleibt unverändert, Fehler in der Zeile
- Modus `repair`: nie Wiederverwendung, auch bei gleichem Fingerabdruck
- `erzwingen: true`: voller Weg

**Messung vor und nach** auf Peters Archiv (Library `ID_OnedriveTest`),
Teilbaum `6. bCommonsLab prototyping/24.09 KnowledgeScout`: Zahl der
`getBinary`-Zeilen im Log und Dauer von `abdeckung_scannen` beim ersten und
beim zweiten Lauf. Beide Zahlen in den PR-Body.

## Stufe 2: eine Anfrage statt zwei (wenn Stufe 1 grün ist)

`getBinary` im OneDrive-Provider holt vor dem Inhalt die Dateiinformationen,
obwohl der Aufrufer sie aus dem Listing schon hat. Vorschlag: optionaler
zweiter Parameter `hinweis?: { name: string; size: number; mimeType?: string }`
im `StorageProvider`-Interface (`packages/contracts/src/storage-provider.ts`);
liegt er vor, entfällt die Info-Anfrage. Alle Provider müssen das Interface
weiter erfüllen (`storage-contracts.md` §1, §8): Nextcloud und Filesystem
ignorieren den Hinweis, OneDrive nutzt ihn. Die Engine reicht ihn aus dem
`StorageItem` durch. Eigene PR, damit Stufe 1 nicht daran hängt.

## Regeln

- Contracts: `contracts-storage-twin` (Skill), `shadow-twin-contracts.md`,
  `storage-contracts.md`, `no-silent-fallbacks.md`. Plan-Funktionen bleiben
  rein; kein I/O in `sync-plan/`.
- Dateien über 200 Zeilen aufteilen: `run-library-sync.ts` ist nah an der
  Grenze, das Tor gehört in eine eigene Datei `check-stand.ts` (Fingerabdruck
  rechnen, vergleichen, ablegen).
- `pnpm test`, `pnpm lint`, und `npx tsc --noEmit -p tsconfig.json | grep '^src/'`
  muss leer sein. `pnpm build` lokal beim Owner vor dem Merge.
- Branch `claude/twin-fingerabdruck-<suffix>`, eine PR für Stufe 1, max.
  1.000 Zeilen je Commit. Commit-Messages auf Deutsch.
- Neue Punkte, die beim Bauen sichtbar werden, in `docs/STAND.md` unter
  „Zwischenschnitt Twin-Fingerabdruck" mit Datum eintragen.

## Was bewusst offen bleibt

- Ob der Fingerabdruck auch die Werkbank-Verifikation (`runFieldVerification`)
  entlasten kann: nicht Teil dieser Welle, erst messen.
- Ob `checkStand.zeile` groß wird (Quellen mit vielen Operationen): 500
  Zeilen Report-Limit gilt weiter; bei Bedarf nur Typen und Zähler statt der
  ganzen Zeile ablegen. Entscheidung in der Session, im PR begründen.
