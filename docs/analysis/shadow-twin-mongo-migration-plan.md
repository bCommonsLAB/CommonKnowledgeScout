# Shadow-Twin: MongoDB-Planung und Migration (Batch)

## Einordnung und Ziel
Wir sehen aktuell klare Performance-Engpässe beim Dateisystem-Scan und bei der Shadow‑Twin‑Auflösung. Die Idee, Shadow‑Twins primär in MongoDB zu speichern und das Filesystem optional zu machen, ist sinnvoll. Dadurch wird das Öffnen eines Ordners zu einem reinen Datenbankzugriff, der gut batchbar ist. Das reduziert Latenzen und entkoppelt UI‑Performance von Filesystem‑I/O.

Wichtig ist, dass wir die neue Speicherung **deterministisch** und **konsistent** gestalten. Ein Dokument pro `sourceId` (Original‑File) ist in der Praxis am einfachsten. Es hält alle Varianten (Transcript/Transformation) und referenziert binäre Artefakte über Blob‑URLs. Für Sharing bleibt ein optionaler Filesystem‑Write erhalten, der bewusst deaktivierbar ist.

Die Migration soll als **Batch** gedacht werden: gezielte Libraries werden einmalig importiert. Danach wird das System in einen Dual‑Read‑Modus gebracht (Mongo bevorzugt, Filesystem fallback). So bleibt der Betrieb stabil, während wir schrittweise umstellen.

## Zielbild (Zustand nach Migration)
- Shadow‑Twin‑Artefakte primär in MongoDB gespeichert.
- Filesystem‑Speicherung optional pro Library (z. B. `shadowTwin.persistToFilesystem`).
- UI lädt Shadow‑Twins eines Ordners als **Batch** aus MongoDB.
- Filesystem‑Scan ist optional und nur für Legacy/Sharing notwendig.

## Vorschlag Datenmodell (MongoDB)
Ein Dokument pro Quelle (`sourceId`). Einbettung der Fragmente in einem Dokument reduziert Query‑Overhead.

```json
{
  "_id": "<ObjectId>",
  "libraryId": "ff73d3a2-...",
  "sourceId": "fileId-original",
  "sourceName": "document.pdf",
  "parentId": "folderId",
  "userEmail": "user@example.com",
  "artifacts": {
    "transcript": {
      "de": {
        "markdown": "<md>",
        "createdAt": "2026-01-22T12:00:00Z",
        "updatedAt": "2026-01-22T12:05:00Z"
      }
    },
    "transformation": {
      "templateName": {
        "de": {
          "markdown": "<md>",
          "frontmatter": { "docType": "event", "title": "..." },
          "createdAt": "2026-01-22T12:10:00Z",
          "updatedAt": "2026-01-22T12:11:00Z"
        }
      }
    }
  },
  "binaryFragments": [
    {
      "name": "page-001.png",
      "kind": "image",
      "url": "https://<azure>/.../page-001.png",
      "hash": "abcdef123456",
      "mimeType": "image/png",
      "size": 123456,
      "createdAt": "2026-01-22T12:12:00Z"
    }
  ],
  "filesystemSync": {
    "enabled": false,
    "shadowTwinFolderId": null,
    "lastSyncedAt": null
  },
  "createdAt": "2026-01-22T12:00:00Z",
  "updatedAt": "2026-01-22T12:11:00Z"
}
```

**Collection‑Namen:** `shadow_twins__${libraryId}` (analog zu `vectors__${libraryId}`)

**Indizes (Minimum):**
- `{ libraryId: 1, parentId: 1 }` für Ordner‑Batch‑Loading
- `{ libraryId: 1, sourceId: 1 }` unique
- `{ libraryId: 1, "artifacts.transformation.*.*.updatedAt": -1 }` optional, falls “latest transformation” benötigt wird

## Batch‑Migration (theoretischer Ablauf)
1. **Scope bestimmen:** Welche Libraries migriert werden (Batch‑Auswahl).
2. **Scan Quelle:** Für jede Library: Ordnerinhalt einmalig laden, Shadow‑Twin‑Ordner/Dateien auflösen.
3. **Parse Artefakte:** Transcript/Transformation anhand der bekannten Namenskonventionen erkennen.
4. **Persistieren:** Ein Dokument pro `sourceId` upserten.
5. **Binary‑Assets:** Bilder in Azure, URLs in Mongo speichern (vorhandene Upload‑Logik nutzen).
6. **Dual‑Read aktivieren:** UI/Resolver liest primär aus Mongo; Filesystem fallback.
7. **Write‑Pfad ändern:** Neue Shadow‑Twins zuerst in Mongo speichern; Filesystem optional.
8. **Validieren:** Stichproben, Counts, Checksummen (z. B. Anzahl Artefakte je Quelle).

## Risiken und Gegenmaßnahmen
1. **Dateninkonsistenz (Mongo vs Filesystem)**  
   - Risiko: Unterschiedliche Stände nach Migration.  
   - Gegenmaßnahme: Dual‑Read‑Phase + Vergleichslogik, Migrationsreport mit Differenzen.

2. **Große Dokumente (Mongo 16MB Limit)**  
   - Risiko: Sehr große Markdown‑Artefakte + viele Fragmente.  
   - Gegenmaßnahme: Große Markdown‑Bodies optional in Blob‑Storage, Mongo nur Referenzen.

3. **Fehlende Template‑Zuordnung**  
   - Risiko: Transformationen ohne Template‑Namen.  
   - Gegenmaßnahme: Heuristik „neueste Transformation“ + Flag `templateName: "unknown"`.

4. **Binary‑Assets im Filesystem**  
   - Risiko: Bilder sind noch nicht in Azure.  
   - Gegenmaßnahme: Migration enthält Upload‑Schritt + URL‑Rewrite.

5. **Performance bei Batch‑Migration**  
   - Risiko: I/O‑Last auf Filesystem.  
   - Gegenmaßnahme: Throttling, Chunk‑Batching, Lauf außerhalb UI‑Peak.

6. **Rollback‑Strategie**  
   - Risiko: Migration erzeugt fehlerhafte Mongo‑Daten.  
   - Gegenmaßnahme: Mongo‑Writes über Version‑Feld; mit Flag deaktivierbar.

## Konkrete nächste Schritte (Planung)
1. **Schema fixieren** (finale Felder + Indexe).
2. **Library‑Flag definieren** (`shadowTwin.persistToFilesystem` + `shadowTwin.primaryStore = "mongo"`).
3. **Batch‑Importer entwerfen** (CLI oder API‑Route).
4. **Dual‑Read implementieren** (Mongo zuerst, Filesystem fallback).
5. **Validation‑Report** definieren (Counts, Sample‑Diffs).

## Entscheidungspunkte
- **Ein Dokument vs mehrere Dokumente:** Hier empfohlen: **ein Dokument pro `sourceId`**.
- **Binary‑Assets:** URLs in Mongo, Inhalte in Azure (kein Filesystem‑Zugriff im UI).
- **Rollback:** Lesepfad kann per Feature‑Flag auf Filesystem zurückgestellt werden.
