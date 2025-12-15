# Shadow-Twin Migration & Items - Variante 1

## Übersicht

Dieses Dokument beschreibt die Migration von Shadow-Twin-Dateien im Filesystem zu einem generischen Item-Modell in MongoDB (Variante 1). Kernidee: **MetaDocument = Item**, Shadow-Twin-Information liegt vollständig in MongoDB, nicht mehr im Storage.

## Variante 1: MetaDocument als Item

### Konzept

In Variante 1 wird das bestehende `MetaDocument` (`kind: 'meta'` in `vectors__<libraryId>`) **konzeptionell als Item** betrachtet:

- **Item = MetaDocument**: Das `MetaDocument` aus `src/lib/ingestion/meta-document-builder.ts` ist die kanonische Shadow-Twin-Repräsentation.
- **Shadow-Twin-Information in Mongo**: `docMetaJson.markdown` enthält den vollständigen Text-Body, `docMetaJson` enthält alle Metadaten + Azure-URLs für Bilder/Slides.
- **Keine separate Collection**: Items werden **nicht** in einer eigenen `items__<libraryId>`-Collection gespeichert, sondern bleiben in `vectors__<libraryId>` als `kind: 'meta'`.

### Vorteile

- **Minimaler Umbau**: Bestehende Struktur wird genutzt, keine neue Collection nötig.
- **Konsistenz**: Item-Information liegt bereits in Mongo, nur die Abhängigkeit von Shadow-Twin-Dateien im Storage fällt weg.
- **Schnelle Umsetzung**: Keine großen Refactors, nur schrittweise Umstellung der Lese-/Schreibpfade.

### Nachteile

- **Größe der Mongo-Dokumente**: Wenn `docMetaJson.markdown` sehr groß ist, enthält die Vector-Collection große Dokumente. (Aber: Das ist bereits heute der Fall, kein neues Problem.)
- **Keine strikte Trennung**: Content-Store und Suchindex sind in derselben Collection. (Aber: Funktioniert bereits gut, keine technische Notwendigkeit für Trennung.)

## Zielbild: Shadow-Twin vollständig in MongoDB

### Was liegt wo?

| Daten | Speicherort | Beschreibung |
|-------|------------|--------------|
| **Original-Dateien** (PDF, Video, Audio) | Storage-Provider (Filesystem/OneDrive/Azure-Blob) | Nur für Download/Backup, nicht für Ingestion |
| **Item-Repräsentation** (Meta + Markdown) | MongoDB `vectors__<libraryId>` (`kind: 'meta'`) | Vollständiger Shadow-Twin |
| **Binärartefakte** (Bilder, Slides, Audio-Snippets) | Azure Blob Storage | URLs in `Item.attachments` bzw. `docMetaJson.slides`, `docMetaJson.coverImageUrl` |
| **Vektoren** (Chunks, ChapterSummaries) | MongoDB `vectors__<libraryId>` (`kind: 'chunk'`, `kind: 'chapterSummary'`) | Für RAG/Suche |

### Was fällt weg?

- **Shadow-Twin-Markdown-Dateien im Storage**: Nicht mehr nötig, da `docMetaJson.markdown` die kanonische Quelle ist.
- **Shadow-Twin-Verzeichnisse im Storage**: Nicht mehr nötig, da Bilder auf Azure liegen und URLs in `docMetaJson` gespeichert sind.

## Migrationsstrategie

### Schritt 1: Bestandsaufnahme

Für jede Library (`vectors__<libraryId>`) prüfen:

1. **Meta-Dokumente ohne Markdown**:
   - Alle `kind: 'meta'`-Dokumente laden.
   - Prüfen, ob `docMetaJson.markdown` vorhanden und vollständig ist.
   - Prüfen, ob Azure-URLs für Bilder/Slides vorhanden sind.

2. **Shadow-Twin-Dateien im Storage**:
   - Prüfen, ob noch relevante Shadow-Twin-Markdown-Dateien existieren.
   - Prüfen, ob noch lokale Bildpfade in `docMetaJson` vorhanden sind (die auf Azure migriert werden müssen).

### Schritt 2: Migration pro Library

Für jedes Meta-Dokument ohne vollständiges `docMetaJson.markdown`:

1. **Shadow-Twin-Markdown nachladen**:
   - Über `StorageProvider` + `shadow-twin.ts` die Markdown-Datei aus dem Storage laden.
   - Falls nicht vorhanden: Warnung loggen, Item überspringen.

2. **Bilder auf Azure migrieren** (falls nötig):
   - Lokale Bildpfade in `docMetaJson` identifizieren.
   - Bilder auf Azure hochladen (über `ImageProcessor.processSlideImages`, `ImageProcessor.processCoverImage`, etc.).
   - URLs in `docMetaJson` aktualisieren.

3. **Meta-Dokument aktualisieren**:
   - `docMetaJson.markdown` setzen.
   - `docMetaJson.slides`, `docMetaJson.coverImageUrl` mit Azure-URLs aktualisieren.
   - Optional: `docMetaJson.migrationVersion = '1'` setzen, um migrierte Items zu kennzeichnen.
   - `upsertVectorMeta` aufrufen, **ohne** Vektoren neu zu berechnen.

**Wichtig**: Migration ändert **nur** das Meta-Dokument, keine Vektoren. Vektoren bleiben unverändert.

### Schritt 3: Verifizierung

Nach Migration pro Library:

1. **Manuelle Prüfung**:
   - Einige Items im Frontend/DB inspizieren: Ist `docMetaJson.markdown` vorhanden? Sind Azure-URLs korrekt?
   - Chat/RAG-Queries testen: Funktionieren alte Queries wie erwartet?

2. **Monitoring**:
   - Logs prüfen: Wurden alle Items migriert? Gab es Fehler?
   - Collection-Größe prüfen: Ist `docMetaJson.markdown` vollständig vorhanden?

## Rollout-Reihenfolge

### Pilot-Migration (Test-Library)

1. **Kleine, homogene Library auswählen**:
   - Z.B. nur einige PDF-Dokumente oder ein kleiner Event-Satz.
   - Möglichst wenig Variation in Item-Typen.
   - Beispiel: Eine Library mit 5-10 PDF-Dokumenten, die bereits vollständig inges­tiert sind.

2. **Migrations-Script testen**:
   - Script in `scripts/migrate-shadow-twins-to-meta.ts` ist bereits konzipiert.
   - **Dry-Run-Modus**: 
     ```bash
     pnpm tsx scripts/migrate-shadow-twins-to-meta.ts --libraryId=test-lib --dryRun
     ```
     - Prüft alle Items, loggt was migriert werden würde, macht keine DB-Änderungen.
   - **Echte Migration**: 
     ```bash
     pnpm tsx scripts/migrate-shadow-twins-to-meta.ts --libraryId=test-lib
     ```
     - Migriert alle Items, die noch kein vollständiges `docMetaJson.markdown` haben.

3. **Verifizierung nach Migration**:
   - **Manuelle Prüfung**:
     - Einige Items in MongoDB prüfen: Ist `docMetaJson.markdown` vorhanden und vollständig?
     - Sind Azure-URLs korrekt (falls Bilder vorhanden)?
     - Ist `migrationVersion = '1'` gesetzt?
   - **Funktionale Tests**:
     - Chat/RAG-Queries testen: Funktionieren alte Queries wie erwartet?
     - Gallery-Anzeige testen: Werden Items korrekt angezeigt?
     - Detailansichten testen: Wird Markdown korrekt gerendert?

4. **Lessons Learned dokumentieren**:
   - Was hat funktioniert? Was nicht?
   - Welche Edge-Cases sind aufgetreten?
   - Script anpassen, falls nötig.
   - Dokumentation aktualisieren.

### Rollout für weitere Libraries

1. **Prioritätenliste**:
   - Libraries nach Wichtigkeit/Volumen sortieren.
   - Zuerst kleinere Libraries, dann größere.
   - Beispiel-Reihenfolge:
     - `test-library` (Pilot)
     - `biotif` (PDF-Dokumente, mittlere Größe)
     - `dialog-events` (Events, klein)
     - `sfscon-talks` (Events, größer)
     - `jobs-*` (JobOffers, wenn vorhanden)

2. **Backup vor Migration**:
   - Export der `vectors__<libraryId>`-Collection vor Migration:
     ```bash
     mongodump --uri="<MONGODB_URI>" --db=<DB_NAME> --collection=vectors__<libraryId> --out=./backups/before-migration-<libraryId>
     ```
   - Falls nötig: Rollback möglich durch Restore:
     ```bash
     mongorestore --uri="<MONGODB_URI>" --db=<DB_NAME> --collection=vectors__<libraryId> ./backups/before-migration-<libraryId>/<DB_NAME>/vectors__<libraryId>.bson
     ```

3. **Library-weise Migration**:
   - Script mit `--libraryId` parametrisieren (bereits implementiert).
   - Pro Library: 
     1. **Backup**: Collection exportieren
     2. **Dry-Run**: `--dryRun` ausführen, Statistiken prüfen
     3. **Migration**: Echte Migration ausführen
     4. **Verifizierung**: Manuelle Prüfung + funktionale Tests
     5. **Weiter**: Nächste Library

4. **Monitoring während Migration**:
   - Logs prüfen: `FileLogger`-Ausgaben in Logs
   - Statistiken prüfen: Wie viele Items wurden migriert? Wie viele Fehler?
   - Performance prüfen: Wie lange dauert die Migration pro Library?

5. **Dokumentation aktualisieren**:
   - Nach erfolgreicher Migration: Status in `docs/_analysis/mongodb-vector-search-ingestion-analysis.md` aktualisieren
   - Liste der migrierten Libraries führen

## Migrations-Script-Konzept

### Script-Struktur

```typescript
// scripts/migrate-shadow-twins-to-meta.ts

interface MigrationOptions {
  libraryId: string;
  dryRun?: boolean;          // Nur Logging, keine DB-Änderungen
  skipImages?: boolean;       // Bilder nicht auf Azure migrieren
  force?: boolean;            // Auch Items mit markdown migrieren (Neu-Upload)
}

async function migrateLibrary(options: MigrationOptions) {
  // 1. Meta-Dokumente laden
  // 2. Für jedes Item ohne markdown:
  //    - Shadow-Twin-Markdown nachladen
  //    - Bilder auf Azure migrieren (falls nötig)
  //    - Meta-Dokument aktualisieren
  // 3. Logging + Statistiken
}
```

### Wichtige Funktionen

- **Shadow-Twin-Markdown nachladen**: `StorageProvider` + `shadow-twin.ts` verwenden.
- **Bilder auf Azure migrieren**: `ImageProcessor.processSlideImages`, `ImageProcessor.processCoverImage` verwenden.
- **Meta-Dokument aktualisieren**: `upsertVectorMeta` verwenden, **ohne** Vektoren neu zu berechnen.

## Nach der Migration: Shadow-Twin-Dateien abschalten

### Phase 1: Lesezugriffe umstellen

**Ziel**: Alle Stellen, die Shadow-Twin-Markdown aus dem Storage laden, auf Item-Zugriff umstellen.

**Betroffene Dateien**:
- `src/app/api/chat/[libraryId]/ingest-markdown/route.ts` - Lädt Markdown aus Storage (Zeile 41)
- `src/components/library/gallery/detail-overlay.tsx` - Lädt möglicherweise Markdown aus Storage
- Weitere Komponenten, die `findShadowTwinMarkdown` oder ähnliche Funktionen verwenden

**Umstellung**:
1. **Backend-API erstellen**: `/api/items/[libraryId]/[fileId]` - Lädt Item aus Mongo, gibt Markdown zurück
2. **Frontend-Komponenten anpassen**: Statt Storage-Zugriff → API-Zugriff auf Item
3. **Ingestion-Service anpassen**: `upsertMarkdown` sollte nicht mehr auf Shadow-Twin-Dateien zugreifen müssen

**Beispiel**:
```typescript
// Vorher (in ingest-markdown/route.ts)
const provider = await getServerProvider(userEmail, libraryId);
const item = await provider.getItemById(fileId);
const bin = await provider.getBinary(fileId);
const markdown = await bin.blob.text();

// Nachher (neue API-Route)
// /api/items/[libraryId]/[fileId]
const metaDoc = await getVectorCollection(libraryKey).findOne({ 
  kind: 'meta', 
  fileId 
});
const markdown = metaDoc?.docMetaJson?.markdown || '';
```

### Phase 2: Schreibzugriffe umstellen

**Ziel**: Neue Ingestion-Flows sollen **keine** Shadow-Twin-Dateien mehr erzeugen.

**Betroffene Flows**:
- **PDF-Flow**: `src/app/api/chat/[libraryId]/ingest-markdown/route.ts`
- **Event-Flow**: `src/app/api/event-job/jobs/[jobId]/process-direct/route.ts`
- **Testimonial-Flow**: (noch nicht implementiert)

**Umstellung**:
1. **ItemWorker implementieren**: Generischer Worker, der `RawItem` → `Item` macht, **ohne** Storage-Zugriff
2. **Ingestion-Service anpassen**: `upsertMarkdown` sollte direkt `Item` in Mongo speichern, keine Markdown-Datei im Storage erzeugen
3. **Bild-Upload**: Bilder direkt auf Azure hochladen, URLs in `docMetaJson` speichern

**Wichtig**: Nach Umstellung sollten neue Ingestion-Flows **gar keine** Shadow-Twin-Dateien mehr erzeugen.

### Phase 3: Shadow-Twin-Utilities deprecaten

**Schrittweise Deprecation**:

1. **Markieren als Legacy**:
   - `src/lib/storage/shadow-twin.ts` mit `@deprecated`-Kommentaren versehen
   - Dokumentation aktualisieren: "Nur noch für Migration/Legacy-Fälle"

2. **Nur noch für Migration nutzen**:
   - `migrate-shadow-twins-to-meta.ts` darf weiterhin Shadow-Twin-Utilities nutzen
   - Alle anderen Stellen sollten auf Item-Zugriff umgestellt sein

3. **Mittelfristig entfernen**:
   - Sobald alle Libraries migriert sind
   - Sobald alle Lese-/Schreibzugriffe umgestellt sind
   - `src/lib/storage/shadow-twin.ts` kann dann gelöscht werden

**Checkliste vor Entfernung**:
- [ ] Alle Libraries migriert
- [ ] Alle Lesezugriffe umgestellt (keine `findShadowTwinMarkdown` mehr außer Migration)
- [ ] Alle Schreibzugriffe umgestellt (keine `saveShadowTwin` mehr)
- [ ] Migration-Script funktioniert ohne Shadow-Twin-Utilities (oder Migration abgeschlossen)
- [ ] Tests passieren ohne Shadow-Twin-Utilities

## Zusammenfassung: Abschaltungs-Strategie

1. **Nach erfolgreicher Migration**: Lesezugriffe umstellen (Item aus Mongo statt Storage)
2. **Neue Ingestion-Flows**: Keine Shadow-Twin-Dateien mehr erzeugen
3. **Shadow-Twin-Utilities**: Als Legacy markieren, nur noch für Migration nutzen
4. **Mittelfristig**: Utilities entfernen, sobald Migration abgeschlossen ist

**Zeitplan**: 
- Phase 1 (Lesezugriffe): Nach erfolgreicher Pilot-Migration
- Phase 2 (Schreibzugriffe): Parallel zu Worker-Flow-Vereinheitlichung
- Phase 3 (Deprecation): Nach vollständiger Migration aller Libraries

## Zusammenfassung

Variante 1 nutzt die bestehende `MetaDocument`-Struktur als Item-Modell. Migration bedeutet:

1. **Bestandsaufnahme**: Welche Items haben noch kein `docMetaJson.markdown`?
2. **Migration**: Shadow-Twin-Markdown nachladen, Bilder auf Azure migrieren, Meta-Dokument aktualisieren.
3. **Verifizierung**: Items prüfen, Chat/RAG testen.
4. **Rollout**: Library-weise migrieren, Schritt für Schritt.
5. **Abschaltung**: Shadow-Twin-Dateien im Storage nicht mehr nutzen, nur noch Items aus Mongo.

**Vorteil**: Minimaler Umbau, schnelle Umsetzung, bestehende Struktur wird genutzt.

