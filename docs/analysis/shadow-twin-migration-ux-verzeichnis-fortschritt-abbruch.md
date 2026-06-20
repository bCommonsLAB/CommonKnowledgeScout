# Analyse: Migration-UX — Einzel-Verzeichnis, Live-Fortschritt, Abbruch

Stand: 2026-06-19

## 1. Ziel (Wunsch des Users)

Bei einem grossen Archiv:
1. **Einzelnes Verzeichnis** gezielt rekonstruieren (statt immer die ganze Library-Root) und testen.
2. Im UI den **Verlauf live** sehen: "x von y Quellen verarbeitet".
3. Einen laufenden Lauf **abbrechen** koennen.

## 2. Ist-Zustand (code-belegt)

- `POST .../shadow-twins/migrate` akzeptiert bereits `folderId`, `recursive`, `cleanupFilesystem`,
  `dryRun`, `limit`. Der Hook ruft es aber **fest mit `folderId: "root"`** auf
  (`use-shadow-twin-migration.ts`).
- Der Server schreibt waehrend des Laufs **`progress`-Schritte** nach Mongo
  (`route.ts`, `appendMigrationStep`, Intervall 15s, meta `{scanned, total, upserted}`),
  plus `scan_done` mit `total = files.length`.
- Es gibt eine wiederverwendbare **Ordner-Auswahl** `StorageDirectoryPicker`
  (navigiert per `provider.listItemsById`, kennt intern die Ordner-`id`).
- Run-Liste: `GET .../shadow-twins/migrations?limit=` liefert Runs inkl. `steps`.
- **Fehlt:** Client-Polling waehrend des Laufs (der `fetch` blockt bis zum Ende) und
  ein **Abbruch-Mechanismus** (die Route laeuft immer bis zum Ende durch).

## 3. Capability A — Einzel-Verzeichnis rekonstruieren

| Variante | Beschreibung | Pro | Contra |
|---|---|---|---|
| A1 (empfohlen) | `StorageDirectoryPicker` um optionalen `onSelectFolder(id, path)` erweitern; im Migrations-Dialog einbauen; `folderId` an `migrate` durchreichen | Wiederverwendung, minimal, storage-abstrakt (opaque `folderId`) | Picker bekommt eine zusaetzliche Prop |
| A2 | Eigener Picker nur im Wizard | Volle Kontrolle | Code-Duplikat |
| A3 | Kontextmenue im Haupt-Datei-Baum "Dieses Verzeichnis rekonstruieren" | Beste UX-Integration | Groesste Aenderungsflaeche, mehr Risiko |

## 4. Capability B — Live-Fortschritt x/y

| Variante | Beschreibung | Pro | Contra |
|---|---|---|---|
| B1 (empfohlen) | Waehrend des laufenden `fetch` parallel `GET migrations/{runId}` alle ~2-3s pollen, letzten `progress`/`scan_done`-Schritt anzeigen. Progress-Intervall im Server auf ~2s senken | Nutzt vorhandene Daten, kleiner Eingriff | Zwei parallele Requests (Lauf + Poll) |
| B2 | Server-Sent-Events-Stream wie bei external-jobs | Sehr reaktiv | Mehr Infrastruktur, hoeheres Risiko |
| B3 | `migrate` fire-and-forget: sofort `runId` zurueck, Lauf im Hintergrund, nur noch pollen | Saubere Trennung | Hintergrund-Ausfuehrung in Next-Dev unzuverlaessig; groesserer Umbau |

Voraussetzung fuer B1: leichte `GET migrations/{runId}`-Route (nur ein Run inkl. `steps`),
damit nicht die ganze Liste gepollt wird.

## 5. Capability C — Lauf abbrechen

| Variante | Beschreibung | Pro | Contra |
|---|---|---|---|
| C1 (empfohlen) | Kooperativer Abbruch: Feld `cancelRequested` im Run-Dokument; neue Route `POST migrations/{runId}/cancel`; die Migrations-Schleife prueft die Flag (gedrosselt, z.B. alle ~2s ein `findOne`) und bricht sauber ab -> `finishMigrationRun(status: 'cancelled', report)` mit Teil-Report | Zuverlaessig, sauberer Teil-Report, idempotent dank V2-Skip | Minimaler DB-Poll im Server-Loop |
| C2 | Client-`AbortController` auf den `fetch` | Trivial im Client | Stoppt nur den HTTP-Request, NICHT die Server-Schleife -> Arbeit laeuft weiter |
| C3 | Prozess/Server killen | — | Inakzeptabel, trifft alles |

Status-Union wird um `'cancelled'` erweitert.

## 6. Empfehlung (kombiniert): A1 + B1 + C1

Begruendung: kleinster, zuverlaessiger Eingriff; nutzt bereits vorhandene Bausteine
(`folderId`, `progress`-Steps, `StorageDirectoryPicker`); kein fragiles Hintergrund-Modell.
Der V2-Skip aus der vorigen Optimierung macht abgebrochene + neu gestartete Laeufe guenstig.

## 7. Betroffene Dateien (klare Eingrenzung)

- `src/lib/repositories/shadow-twin-migration-repo.ts`
  - Status-Union + `cancelRequested?: boolean`
  - `requestMigrationCancel(runId)`, `getMigrationRun(runId)` (oder `isCancelRequested`)
- `src/app/api/library/[libraryId]/shadow-twins/migrate/route.ts`
  - `folderId` aus Body nutzen (bereits vorhanden), Progress-Intervall senken,
    Cancel-Flag pruefen, ggf. `status: 'cancelled'` + Teil-Report
- NEU: `src/app/api/library/[libraryId]/shadow-twins/migrations/[runId]/route.ts`
  - `GET` (ein Run inkl. steps) + `POST .../cancel` (oder `DELETE` = cancel)
- `src/components/settings/library/hooks/use-shadow-twin-migration.ts`
  - `folderId` durchreichen; Progress-Polling; `cancelMigration`; Progress-/Cancel-State
- `src/components/settings/library/migration-wizard-section.tsx`
  - Ordner-Auswahl, Fortschrittsanzeige (x/y + Balken), Abbrechen-Button
  - (Datei ist bereits >600 Zeilen -> neue Teilkomponenten `MigrationFolderSelect`
    und `MigrationProgress` auslagern, statt die Datei weiter aufzublaehen)
- `src/components/settings/storage/storage-directory-picker.tsx`
  - optionale Prop `onSelectFolder(id, path)` (rein additiv)

## 8. Offene Entscheidungen vor Umsetzung

1. Ordner-Auswahl: A1 (Picker im Dialog) oder A3 (Kontextmenue im Datei-Baum)?
2. Soll "Unterordner einbeziehen" (recursive) pro Lauf weiterhin waehlbar bleiben? (Ja-Default)
3. Abbruch-Semantik: Teil-Import behalten (empfohlen, dank Idempotenz) — bestaetigen.
