# MongoDB → PostgreSQL: Analyse und Empfehlung

> Stand: 2026-09-30. Grundlage ist eine vollständige Inventur der
> MongoDB-Nutzung im Repo (Collections, Indizes, Aggregationen, Atlas-Features,
> Tests, Deploy). Das Dokument beantwortet vier Fragen: Welche
> PostgreSQL-Version und welche Komponenten installieren? Was ändert sich,
> was nicht? Wo liegen die Probleme, und wie lassen sie sich lösen?
> Es ist eine Empfehlung, keine Entscheidung; die Entscheidung gehört in ein
> ADR (`docs/adr/`) und ein eigenes Vorhaben in `docs/STAND.md`.

## 1. Kurzfassung

- **Installieren:** PostgreSQL **18.x** (aktuell 18.6) mit den Erweiterungen
  **pgvector 0.8.x**, **PostGIS 3.6.x**, `pg_trgm`, `unaccent`, `citext`,
  `btree_gin`, `pg_stat_statements`. Dazu PgBouncer (optional) und
  pgBackRest oder `pg_dump` für Backups.
- **Vektorsuche** ist machbar, aber die heutige Standard-Dimension **2048**
  (voyage-3-large) liegt über der HNSW-Grenze von 2000 des Typs `vector`.
  Lösung: Typ `halfvec` (bis 4000 Dimensionen, halber Speicher) oder
  Neu-Einbettung mit 1024 Dimensionen (Matryoshka, Qualitätsverlust unter
  einem Prozent).
- **Geodaten** gibt es im Code heute **nicht**. Ortsbezug ist Freitext in
  den Frontmatter-Feldern `region` und `location`. PostGIS ist die richtige
  Basis für das im ADR 0010 skizzierte Geo-Retrieval (Naturmuseum), aber
  Koordinaten müssen erst erfasst werden; Geokodierung ist ein externer Dienst.
- **Nicht genutzt** werden Transaktionen, Change Streams, GridFS,
  TTL-Indizes, `$text`, `$search` und `$graphLookup`. Das erleichtert die
  Migration erheblich.
- **Größter Aufwand:** die Galerie- und Facetten-Aggregationen über das
  schemalose `docMetaJson`, die `libraries`-Collection (Library-Configs als
  Array im User-Dokument), die Shadow-Twin-Maps und die Job-Queue mit
  arrayFilters. Grobe Schätzung: 6 bis 10 Agenten-Wellen, nach dem
  bestehenden Repository-Muster eine Domäne nach der anderen.

## 2. Bestand: Was die Anwendung von MongoDB heute verlangt

### 2.1 Collections

| Gruppe | Collections | Besonderheit |
|---|---|---|
| Global, fester Name | `libraries`, `external_jobs`, `event_jobs`, `event_batches`, `event_sessions`, `templates`, `llm_models`, `chats`, `queries`, `library_members`, `library_access_requests`, `source_user_states`, `source_comments`, `wizard_sessions`, `wizard_submissions`, `mcp_account_keys`, `aktions_protokoll`, `mail_log`, `app_config`, `library_verifications`, `integration_tests`, `overlap_reports` | 22 Collections, alle mit `getCollection()` aus `src/lib/mongodb-service.ts` |
| Pro Library, dynamisch | `doc_meta__<libraryId>` (Meta + Chunks + Kapitelzusammenfassungen + Embeddings), `shadow_twins__<libraryId>`, `archive_item_properties__<libraryId>`, `doc_relations__<libraryId>`, `agent_view_coverage__<libraryId>`, `agent_view_worklists__<libraryId>` | Rund 6 Collections je Library; fast alle Dokumente tragen zusätzlich `libraryId` |

Die Datenbank ist **eine** (`MONGODB_DATABASE_NAME`); der Client ist ein
Singleton mit Pool 5 bis 10 Verbindungen. Mehrere App-Instanzen teilen sich die
Datenbank (`JOBS_WORKER_POOL_ID`).

### 2.2 Genutzte Features

| Feature | Umfang | Belege |
|---|---|---|
| `$vectorSearch` (Atlas) | 1 produktive Abfrage plus Index-Tests; Filter aus `kind`, `libraryId`, `user` und **dynamischen Facetten-Keys**; `numCandidates = topK × 10` | `src/lib/repositories/vector-repo.ts:774-790`, `src/lib/chat/vector-search-index.ts` |
| Atlas-Search-Index per Kommando | `createSearchIndexes`/`listSearchIndexes`, Mapping `knnVector` + `token`-Felder pro Facette, lazy pro Library | `vector-repo.ts:505-530` |
| Aggregationen | 16 Stellen; `$facet` (Facettenzählung), `$lookup` (Sterne, Kommentare), `$unwind`/`$replaceRoot` (`libraries`), `$objectToArray` (Shadow Twins), `$group` | Abschnitt 4 der Inventur, u. a. `vector-repo.ts:1240-1600` |
| Update-Operatoren | `$set` 114, `$push` 14, `$unset` 12, `$setOnInsert` 8; arrayFilters `$[s]`/`$[elem]`, Positional `$`, Pipeline-Updates mit `$mergeObjects`, dynamische Pfade (`artifacts.transformation.<tpl>.<lang>`, `docMetaJson.<key>`) | `external-jobs-repository.ts`, `shadow-twin-repo.ts`, `doc-meta-felder.ts` |
| Query-Operatoren | `$exists` 53, `$in` 42, `$or` 37, `$regex` 35, `$elemMatch` 16, `$expr` 3 | E-Mail-Vergleich per Regex in `library-members-repo.ts`; Freitextsuche in `api/chat/[libraryId]/docs/route.ts` |
| Bulk | `bulkWrite` (Vektoren in 1000er-Batches), `insertMany`/`deleteMany` ohne Transaktion (`doc-relations`, `vector-rekey`) | `vector-repo.ts:620-636`, `vector-rekey.ts:63-64` |
| Indizes | ~45 lazy per `createIndex`; unique, sparse, partial (`queries`, Facetten), Multikey auf Arrays | Abschnitt 2 der Inventur |
| ObjectId | nur 3 Repos (`source_comments`, `wizard_submissions`); sonst String-`_id`s | unkritisch |

### 2.3 Nicht genutzt

Transaktionen, Sessions, Change Streams, GridFS, TTL-Indizes, `$text`,
`$search`, `$graphLookup`, `$setWindowFields`, `$out`/`$merge`, mehrere
Datenbanken. Ebenso keine Geo-Operatoren (`$near`, `2dsphere`) und keine
Koordinatenfelder.

### 2.4 Tests und Umgebung

- Unit-Tests (Vitest) mocken `@/lib/mongodb-service` oder ganze Repos und
  prüfen **Mongo-Filterobjekte wörtlich**. Sie brechen bei einer Migration.
- Echte Datenbank brauchen nur Playwright-E2E (`e2e/helpers.ts`), die
  In-App-Integrationstests (`src/lib/integration-tests/validators.ts`) und
  9 Skripte unter `scripts/`.
- Docker, CI und Electron-Build reichen `MONGODB_URI`, `MONGODB_DATABASE_NAME`
  und `MONGODB_COLLECTION_NAME` durch; die Electron-App verbindet sich direkt
  mit der Datenbank.

## 3. Empfehlung: Version und Komponenten

### 3.1 Versionsmatrix

| Komponente | Empfohlene Version | Warum |
|---|---|---|
| PostgreSQL | **18.x** (18.6, 13.08.2026) | Ein Jahr Reife seit 18.0 (25.09.2025), asynchrones I/O, Support bis 2030. Kein Sprung auf ein frisches 19.0 im ersten Quartal nach Erscheinen; 17.x bleibt eine konservative Alternative, wenn ein Distributionspaket fehlt. |
| pgvector | **0.8.x** (0.8.6, 29.07.2026) | Unterstützt PostgreSQL 18, `halfvec`, HNSW und iterative Index-Scans (`hnsw.iterative_scan`) für gefilterte Suche. Ersetzt `$vectorSearch`. |
| PostGIS | **3.6.x** (3.6.2, 06.02.2026) | Erste PostGIS-Reihe, die für PostgreSQL 18 gebaut wurde; `geography`-Typ, `ST_DWithin`, GiST-Index, Polygone für Gebiete. |
| `pg_trgm` + `unaccent` | mitgeliefert (contrib) | Ersetzt `$regex`-Suchen (Titel, Namen, Fragmente) durch trigramm-indizierte `ILIKE`/`%`-Suche und Ähnlichkeit ohne Umlaut-Falle. |
| `citext` | contrib | E-Mail-Vergleich ohne Groß-/Kleinschreibung statt 21 Regex-Stellen. |
| `btree_gin` | contrib | Kombinierte Indizes aus `library_id` und JSONB-Pfaden. |
| `pg_stat_statements` | contrib | Pflicht für das Nachziehen der Indizes nach der Migration. |
| PgBouncer | 1.2x | Optional. Heute 10 Verbindungen pro App-Instanz; nötig, sobald mehrere Instanzen oder Electron-Clients direkt verbinden. |
| pgBackRest oder `pg_dump` + WAL-Archiv | aktuell | Atlas-Backups entfallen; das ist der wichtigste betriebliche Mehraufwand. |
| Node-Treiber | `postgres` (postgres.js) oder `pg` | Beide stabil; postgres.js ist schneller bei Pipelining, `pg` verbreiteter. |
| Query-Builder / Migrationen | **Drizzle ORM** (mit `drizzle-kit`) | Schema als TypeScript, Migrationen im Repo statt lazy `createIndex`, eingebaute pgvector- und JSONB-Typen; für die dynamischen Facetten-Abfragen weiter `sql`-Templates. Alternative: Kysely. |

**Nicht empfohlen:** FerretDB (MongoDB-Wire-Protokoll auf PostgreSQL). Es
würde die Repos unverändert lassen, aber `$vectorSearch` und
`createSearchIndexes` sind Atlas-Kommandos, die dort nicht existieren; die
Vektorsuche müsste ohnehin neu geschrieben werden, und die Abhängigkeit vom
Mongo-Datenmodell bliebe.

### 3.2 Installationsskizze (Docker)

```dockerfile
# Basis: PostGIS-Image für PostgreSQL 18, pgvector aus dem PGDG-Repo dazu
FROM postgis/postgis:18-3.6
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18-pgvector \
 && rm -rf /var/lib/apt/lists/*
```

```sql
-- Einmalig pro Datenbank
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- plus shared_preload_libraries
```

Konfiguration für Vektoren: `maintenance_work_mem` ≥ 2 GB beim HNSW-Aufbau,
`shared_buffers` 25 % des RAM, `hnsw.ef_search` pro Sitzung auf `topK × 2`
bis `× 4`. Eine Library mit 5.000 Dokumenten à 40 Chunks und 2048
Dimensionen belegt als `halfvec` rund 0,8 GB plus Index.

## 4. Vektorsuche: `$vectorSearch` → pgvector

### 4.1 Das Dimensionsproblem

| Modell | Dimensionen | `vector` + HNSW (max 2000) | `halfvec` + HNSW (max 4000) |
|---|---|---|---|
| voyage-3-large (Default) | 2048 | **nicht indizierbar** | ja |
| text-embedding-3-large | 3072 | **nicht indizierbar** | ja |
| voyage-3-large, Matryoshka | 1024 / 512 | ja | ja |

Die Dimension ist heute **pro Library** konfiguriert
(`config.chat.embeddings.dimensions`). Ein pgvector-Index braucht eine feste
Dimension. Zwei gangbare Wege:

1. **`halfvec` und Teil-Index pro Library** (kein Re-Embedding):
   ```sql
   -- Spalte ohne Typmod, damit jede Library ihre Dimension behält
   ALTER TABLE doc_chunks ADD COLUMN embedding halfvec;
   -- Index je Library mit deren Dimension; die Abfrage muss denselben
   -- Ausdruck und dieselbe WHERE-Bedingung verwenden
   CREATE INDEX doc_chunks_emb_lib_x ON doc_chunks
     USING hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops)
     WHERE library_id = 'lib-x';
   ```
   Das entspricht dem heutigen Muster „Index lazy pro Library anlegen“, nur
   als DDL aus dem Repo statt `createSearchIndexes`.
2. **Standardisierung auf 1024 Dimensionen** (Matryoshka-Kürzung bei
   voyage-3-large, Neu-Einbettung bei OpenAI): eine Spalte `vector(1024)`,
   ein Index, halber Speicher. Laut Voyage liegt der Qualitätsverlust
   gegenüber 2048 unter einem Prozent. Kostet einen Ingestion-Lauf je Library.

Empfehlung: Weg 1 für die Migration, Weg 2 als Standard für neue Libraries.

### 4.2 Filter und Recall

Atlas filtert **vor** der Nachbarsuche über Token-Indizes; pgvector filtert
nach dem Index-Scan. Bei selektiven Filtern (etwa `user = …` und drei
Facetten) liefert HNSW zu wenige Kandidaten. Lösung in pgvector 0.8:
`SET hnsw.iterative_scan = relaxed_order` und `hnsw.ef_search` hoch; der
Index liefert dann nach, bis `LIMIT` erfüllt ist. Für Libraries unter etwa
50.000 Chunks reicht oft ein sequentieller Scan mit `WHERE library_id = …`,
was Postgres selbst entscheidet.

Die dynamischen Facetten-Filter (`$in` auf `authors`, `tags`, `region` …)
werden zu JSONB-Bedingungen: `doc_meta_json @> '{"region": ["Bozen"]}'` oder
`doc_meta_json->'tags' ?| array[…]`, indiziert mit GIN. Die heutige
Warnung „Path needs to be indexed as token“ entfällt.

### 4.3 Abfragemuster

```sql
SELECT id, file_id, kind, chunk_index, text, heading_context,
       1 - (embedding::halfvec(2048) <=> $1::halfvec(2048)) AS score
FROM doc_chunks
WHERE library_id = $2 AND kind IN ('chunk','chapterSummary')
  AND doc_meta_json @> $3::jsonb
ORDER BY embedding::halfvec(2048) <=> $1::halfvec(2048)
LIMIT $4;
```

## 5. Geodaten: was fehlt und was PostGIS liefert

**Heute:** kein Koordinatenfeld, keine räumliche Suche. `region` und
`location` sind Freitext-Facetten (`template-samples/*.md`), gespiegelt in
`docMetaJson` und auf Top-Level, gefiltert per `$in`.

**Was PostGIS kann und was nicht:**

| Bedarf (ADR 0010, Naturmuseum) | PostGIS | Sonst nötig |
|---|---|---|
| Punkt pro Dokument, Umkreissuche „alles in 10 km um Bozen“ | `geography(Point,4326)`, `ST_DWithin`, GiST-Index | Koordinaten müssen ins Frontmatter (flach: `geo_lat`, `geo_lon`, siehe Frontmatter-Regel in `AGENTS.md`) |
| Gebiet statt Punkt („Vinschgau“, Gemeindegrenzen) | Polygone, `ST_Within`, `ST_Intersects` | Gebietsgrenzen als Datensatz (z. B. Open Data der Provinz) einmalig laden |
| Ortsname → Koordinate (Geokodierung) | **nein** | Externer Dienst (Nominatim/Photon) oder das im ADR genannte Ortsnamenverzeichnis; Ergebnis als Pipeline-Post-Prozess speichern |
| Unscharfer Ortsnamen-Abgleich („Meran“ vs. „Merano“) | `pg_trgm` + `unaccent` | Synonymtabelle pflegen |
| Entfernung als Ranking-Merkmal neben Vektor-Score | ja, in einer Abfrage kombinierbar | Gewichtung im Retriever (`geo-prefilter`-Strategie) |

Für reine Punkt-Umkreissuchen genügt auch das contrib-Modul `earthdistance`;
sobald Gebiete oder Karten-Ausgaben (GeoJSON) kommen, ist PostGIS nötig.
Da das Naturmuseum-Projekt beides braucht, ist PostGIS von Anfang an
sinnvoll und kostet nichts, solange keine Tabelle es nutzt.

## 6. Was sich ändert, was nicht

| Bereich | Ändert sich | Bleibt |
|---|---|---|
| Storage-Provider (Filesystem, OneDrive, Nextcloud), Azure Blob, Twin-Dateien | nichts | Alles; `storage-abstraction.md` ist nicht betroffen |
| Secretary-Service, Embedding-Erzeugung, LLM-Aufrufe | nichts | Embeddings kommen weiter vom Secretary |
| Repository-Schnittstellen (`src/lib/repositories/*`, `*-repository.ts`) | Implementierung komplett | Exportierte Funktionen und Rückgabetypen, sofern die Signaturen keine Mongo-Typen (`Filter`, `Document`, `ObjectId`) tragen |
| API-Routen und UI | nur Stellen mit direkten Mongo-Filtern (u. a. `api/chat/[libraryId]/docs/route.ts`, `docs/ids`, `speaker-images`, `by-fileids`, `library-service.ts`) | Alle Routen ohne DB-Import |
| Datenmodell | Collections → Tabellen; `<domain>__<libraryId>` → eine Tabelle mit `library_id`; `libraries` → normalisiert; Config und `docMetaJson` als JSONB | Feldnamen und Dokumentformen (Meta/Chunk/ChapterSummary, Shadow-Twin-Artefakte) |
| Indizes | Lazy `createIndex` im Code → Migrationen im Repo | Die fachlichen Unique-Keys (jobId, chatId, `{libraryId,sourceId}` …) |
| Vektorsuche | `$vectorSearch` → pgvector, Index-Anlage per DDL | Retriever-Contracts (`chat-contracts.md`), `topK`, Cosine |
| Tests | Unit-Tests der Repos (Filterobjekte) neu; E2E-Helfer und Integrationstests auf SQL | Alle Tests ohne DB-Bezug |
| Betrieb | Backups, Updates, Monitoring selbst; Verbindung `DATABASE_URL` statt drei Env-Variablen | Docker-Deploy, Clerk, Blob |
| Docs | `mongodb-repository-pattern.md`, `mongodb-vector-search.md`, `mongodb-indexes.md`, `ingest-mongo-only.md`, Teile von `shadow-twin.md` | Contracts, die nur „persistiert in der Datenbank“ meinen |

## 7. Pro und Contra

| | Pro PostgreSQL | Contra PostgreSQL (bzw. Pro Atlas) |
|---|---|---|
| Kosten | Keine Atlas-Stufe M10+ für Vector Search; ein Server trägt Daten, Vektoren, Geo | Eigene Betriebsarbeit (Backups, Updates, Monitoring) |
| Abhängigkeit | Offene Software, keine proprietären Kommandos (`createSearchIndexes`) | Kein gehosteter Ausfallschutz; Replikation muss man selbst aufsetzen |
| Vektoren | pgvector genügt für die Größenordnung (Zehntausende Chunks pro Library); Filter und Vektor in einer Transaktion | Atlas filtert vor dem ANN (besserer Recall bei selektiven Filtern); 2048/3072 Dimensionen brauchen `halfvec` |
| Geo | PostGIS ist der Standard; ADR 0010 wird ohne Graph-DB machbar | Atlas hat `2dsphere`, aber nicht in `$vectorSearch`-Filtern |
| Datenmodell | Transaktionen (Claim der Job-Queue, delete+insert bei Relations), Fremdschlüssel, keine Collection-Explosion pro Library | Dynamische Facetten-Keys und verschachtelte Maps sind in Mongo bequemer; JSONB verlangt sorgfältige Indizes |
| Suche | `pg_trgm`, Volltext (`tsvector`), `unaccent` eingebaut | — |
| Entwicklung | Schema als Code, Migrationen im Repo, Typsicherheit über Drizzle | 40 Dateien und rund 35 Test-Dateien anfassen; Aggregationen werden zu dynamischem SQL |
| Konventionen im Repo | „Eine Collection pro Library“ entfällt zugunsten `library_id`; das passt zu ADR 0009 (Föderation über Libraries) | `mongodb-repository-pattern.md` und `ingest-mongo-only.md` werden umgeschrieben |

## 8. Probleme und Lösungen

| # | Problem | Lösung | Aufwand |
|---|---|---|---|
| 1 | **Dimension 2048/3072 > HNSW-Grenze 2000** | `halfvec` mit Ausdrucks-Index pro Library (Abschnitt 4.1) oder Matryoshka 1024 | klein bis mittel |
| 2 | **Dimension pro Library unterschiedlich** | Spalte `halfvec` ohne Typmod plus Teil-Index `WHERE library_id = …`; DDL pro Library aus dem Repo, das heutige `ensureVectorSearchIndex` wird zu `ensureVectorIndex(libraryId, dim)` | klein |
| 3 | **Pre-Filter-Recall** bei selektiven Facetten | `hnsw.iterative_scan = relaxed_order`, `ef_search` hoch; Planner wählt bei kleinen Libraries den Seq-Scan | klein, Messung nötig |
| 4 | **Facettenzählung `$facet`** über dynamische Keys, Top-Level und `docMetaJson` gleichzeitig | Nur noch JSONB (`doc_meta_json`), die Top-Level-Spiegelung (`TOP_LEVEL_SPIEGEL` in `doc-meta-felder.ts`) entfällt; Zählung mit `jsonb_array_elements_text` + `GROUP BY` je Facette in einer `UNION ALL`-Abfrage; GIN-Index `(library_id, doc_meta_json)` via `btree_gin` | mittel |
| 5 | **Dynamische Feldnamen aus der Library-Config** (Facetten, `groupBy`, Sortierung) → SQL-Injection-Risiko | Keys nur aus der geprüften Facetten-Definition der Library, nie aus der URL; Zugriff über Parameter `doc_meta_json -> $1`, nie per String-Konkatenation; Whitelist-Test im Unit-Test | klein, aber Contract |
| 6 | **Gruppierte Galerie mit N+1-Aggregationen** (`vector-repo.ts:1363-1459`) | Eine Abfrage mit Window-Funktion `ROW_NUMBER() OVER (PARTITION BY gruppe ORDER BY …)`; nebenbei ein Performance-Gewinn | mittel |
| 7 | **`$lookup` für Sterne und Kommentare** in der Galerie-Liste | `LEFT JOIN LATERAL` oder korrelierte Subselects auf `source_user_states` und `source_comments`; ADR 0002 bleibt erfüllt | klein |
| 8 | **`libraries` als Array im User-Dokument** (`$unwind`, Positional `libraries.$`, sparse Indizes auf Array-Pfade, Voll-Scans) | Normalisieren: `users(email citext PK)`, `libraries(id PK, owner_email, config jsonb, is_public, slug unique)`; Secrets im JSONB bleiben, Zugriff über `LibraryService` unverändert; Slug- und Public-Abfragen werden triviale Indizes | mittel bis groß (größte Einzeldomäne, viele Aufrufer) |
| 9 | **Shadow Twins**: Map `artifacts.transformation.<tpl>.<lang>`, `binaryFragments[]`, arrayFilters, `$objectToArray` | Zerlegen in `shadow_twins(library_id, source_id)`, `shadow_twin_artifacts(twin_id, template, lang, frontmatter jsonb, …)`, `shadow_twin_fragments(twin_id, name, hash, variant, …)`; alle Legacy-Formen werden beim Import einmalig migriert statt beim Schreiben | groß |
| 10 | **Job-Queue** (`external_jobs`): Claim ohne Transaktion, `steps[]`/`trace.spans[]` mit arrayFilters, Pipeline-Updates | `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED)`; `steps` und `spans` als eigene Tabellen oder JSONB mit `jsonb_set`; `$mergeObjects` wird `parameters || $1::jsonb` | mittel |
| 11 | **delete+insert ohne Atomarität** (`doc_relations`, `vector-rekey`) | Transaktion; Re-Key wird ein `UPDATE … SET id = …`, weil Postgres-Primärschlüssel änderbar sind | klein, Gewinn |
| 12 | **35 Regex-Stellen** (E-Mail-Vergleich, Suche) | `citext` für E-Mails; `ILIKE` mit `pg_trgm`-GIN für Titel/Namen; `unaccent` für Umlaute | klein |
| 13 | **`$exists`/`$type`-Filter** auf optionalen Feldern | `doc_meta_json ? 'key'`, `jsonb_typeof(...) = 'number'`; Coalesce mit `COALESCE(doc_meta_json->>'x', …)` | klein |
| 14 | **Multikey-Indizes** (`supportedLanguages`, `jobIds`, `tags`) | GIN auf `jsonb`/`text[]`-Spalten | klein |
| 15 | **ObjectId** in `source_comments`, `wizard_submissions` | `uuid` mit `gen_random_uuid()`; beim Import ObjectId-Hex als Text übernehmen (24 Zeichen), damit Links und E2E-Fixtures gültig bleiben | klein |
| 16 | **Lazy `createIndex` und `indexCache`** in jedem Repo | Entfällt; Indizes liegen in `drizzle/`-Migrationen. Einzige Ausnahme: der Vektor-Teil-Index pro Library (Punkt 2) | klein, viele Stellen |
| 17 | **Unit-Tests prüfen Mongo-Filter wörtlich** (~35 Dateien) | Tests gegen ein echtes Postgres in CI (`services: postgres` mit pgvector-Image, kostenlos in GitHub Actions) statt Fake-Collections; die Vitest-Mocks auf Repo-Ebene bleiben | mittel |
| 18 | **Integrationstests und Skripte** mit `$vectorSearch` und `new MongoClient` (9 Skripte, `validators.ts`, `e2e/helpers.ts`) | Skripte auf `postgres.js` umstellen oder als erledigte Einmal-Migrationen archivieren (`scripts/migrate-*`, `normalize-*`) | klein |
| 19 | **Electron-App verbindet direkt** mit der Datenbank (`electron-build.yml`) | Unverändert möglich (`DATABASE_URL` statt `MONGODB_URI`); langfristig besser über die HTTP-API der Instanz, aber das ist ein eigenes Thema | keiner für die Migration |
| 20 | **Datenübernahme** (Bestand aus Atlas) | Export je Collection mit `mongoexport --jsonArray`, Import per Skript pro Domäne; Embeddings als Float-Array → `halfvec`; einmaliges Downtime-Fenster statt Doppelbetrieb, da eine Instanz und ein Owner | mittel |
| 21 | **Contract `ingest-mongo-only.md`** und Doku-Namen | Umbenennen in `ingest-db-only.md`; Aussage bleibt: kein Fallback aufs Dateisystem | klein |

## 9. Zieldatenmodell (Skizze)

```text
users(email citext PK, created_at)
libraries(id text PK, owner_email → users, name, slug unique, is_public,
          config jsonb, created_at, updated_at)
library_members(library_id, user_email, role, invite_token unique null, …)
library_access_requests(id PK, library_id, …, invite_token unique null)

doc_meta(library_id, file_id, doc_meta_json jsonb, publication_status,
         year, updated_at, PK(library_id, file_id))              -- kind = meta
doc_chunks(id text PK, library_id, file_id, kind, chunk_index,
           text, heading_context, start_char, end_char,
           embedding halfvec, doc_meta_json jsonb)                -- chunk + chapterSummary
   GIN (library_id, doc_meta_json) via btree_gin
   HNSW ((embedding::halfvec(N)) halfvec_cosine_ops) WHERE library_id = …
doc_relations(library_id, source_id, target_id, kind, weight, …)

shadow_twins(id PK, library_id, source_id, …, UNIQUE(library_id, source_id))
shadow_twin_artifacts(twin_id, template, lang, frontmatter jsonb, …)
shadow_twin_fragments(twin_id, name, hash, variant, …)

external_jobs(job_id PK, status, worker_pool_id, parameters jsonb,
              cumulative_meta jsonb, correlation jsonb, result jsonb, …)
external_job_steps(job_id, step_key, status, …)
external_job_spans(job_id, span_id, started_at, ended_at, …)

templates, llm_models, chats, queries(cache_hash …), source_user_states,
source_comments(id uuid, revisions jsonb), wizard_sessions,
wizard_submissions(id uuid), mcp_account_keys, aktions_protokoll, mail_log,
app_config, library_verifications, integration_tests, overlap_reports,
archive_item_properties, agent_view_coverage, agent_view_worklists
-- alle mit library_id-Spalte statt Collection-Suffix

-- vorbereitet, noch ohne Konsument:
doc_geo(library_id, file_id, point geography(Point,4326), area geography)
   GIST (point), GIST (area)
```

Faustregel: Fachliche Schlüssel und Filterfelder werden Spalten,
Template-abhängige Inhalte bleiben JSONB. Das entspricht der heutigen
Trennung Top-Level/`docMetaJson`, nur ohne die doppelte Ablage.

## 10. Vorgehen

Das Repository-Muster ist die Naht: jede Domäne hat ein Repo mit
exportierten Funktionen. Vorschlag in Wellen, jede mit eigener PR und
grünem `pnpm test`, `pnpm lint` und `tsc`:

| Welle | Inhalt | Warum in dieser Reihenfolge |
|---|---|---|
| P0 | ADR „Datenbank PostgreSQL“, Drizzle-Setup, `DATABASE_URL`, Docker-Image, CI-Service, Migrationsordner, `src/lib/db/postgres.ts` als einziger Einstieg (analog `mongodb-service.ts`) | Fundament, kein Verhalten ändert sich |
| P1 | Blattdomänen ohne Aggregation: `app_config`, `mail_log`, `aktions_protokoll`, `mcp_account_keys`, `llm_models`, `templates`, `overlap_reports`, `integration_tests`, `library_verifications`, `archive_item_properties`, `agent_view_*` | Muster einüben, Tests umstellen |
| P2 | `users`/`libraries`/`members`/`access_requests` | Alles Weitere hängt an `library_id` |
| P3 | `source_user_states`, `source_comments`, `chats`, `queries`, `wizard_*` | Mittlere Komplexität, ObjectId → uuid |
| P4 | Job-Queue (`external_jobs`, `event_*`) mit `SKIP LOCKED` | Pipeline-Contracts (`contracts-story-pipeline.md`) prüfen |
| P5 | Shadow Twins | Größte Umstrukturierung, eigener Brief |
| P6 | `doc_meta`/`doc_chunks`, pgvector, Facetten, Galerie, Retriever | Kern; zuletzt, weil alles andere dann steht |
| P7 | Datenübernahme, Cutover, Mongo-Skripte archivieren, Docs und Contracts umschreiben | Abschluss |

Während P1 bis P6 laufen beide Datenbanken parallel im Code (jede Domäne ist
entweder Mongo oder Postgres, nie beides). Ein Dual-Write ist nicht nötig.

## 11. Offene Entscheidungen für den Owner

1. **Dimension:** `halfvec` behalten (kein Re-Embedding) oder auf 1024
   standardisieren (ein Ingestion-Lauf je Library, weniger Speicher)?
2. **Cutover-Fenster:** einmaliger Export/Import mit Stillstand von wenigen
   Stunden, oder Doppelbetrieb je Domäne über Wochen?
3. **Betrieb:** Postgres im selben Docker-Compose wie die App oder als
   eigener Dienst mit pgBackRest und Replikation?
4. **Geo jetzt oder später:** PostGIS mitinstallieren (empfohlen, kostet
   nichts) und die Koordinatenfelder erst mit dem Naturmuseum-Vorhaben
   erfassen.
5. **Einordnung in `STAND.md`:** eigenes Vorhaben nach SHF, oder Welle P0
   schon in Vorhaben 2 vorziehen, weil der Server ohnehin neu aufgesetzt wird?

## 12. Quellen

- pgvector: [CHANGELOG](https://github.com/pgvector/pgvector/blob/master/CHANGELOG.md),
  [Index-Leitfaden (dbi-services, März 2026)](https://www.dbi-services.com/blog/pgvector-a-guide-for-dba-part-2-indexes-update-march-2026/),
  [Release-Notes 2026](https://dbadataverse.com/tech/postgresql/2026/05/pgvector-release-notes-updates-2026)
- PostgreSQL 18: [Dokumentation 18.6](https://www.postgresql.org/docs/current/index.html),
  [Versionsübersicht und Support-Ende](https://www.instaclustr.com/education/postgresql/postgres-versions-supported-releases-eol-dates-upgrades/)
- PostGIS: [3.6.0-Ankündigung](https://postgis.net/2025/09/PostGIS-3.6.0/),
  [freigegebene Versionen](https://postgis.net/documentation/getting_started/install_windows/released_versions/),
  [Docker-Image und Postgres-Versionen](https://github.com/postgis/docker-postgis/issues/438)
- voyage-3-large und Matryoshka: [Voyage-Blog](https://blog.voyageai.com/2025/01/07/voyage-3-large/),
  [MongoDB zu Matryoshka-Embeddings](https://www.mongodb.com/company/blog/technical/matryoshka-embeddings-smarter-embeddings-with-voyage-ai)
- Repo: `src/lib/mongodb-service.ts`, `src/lib/repositories/vector-repo.ts`,
  `src/lib/chat/vector-search-index.ts`, `src/lib/chat/config.ts`,
  `src/lib/services/library-service.ts`, `src/lib/repositories/shadow-twin-repo.ts`,
  `src/lib/external-jobs-repository.ts`, `docs/architecture/mongodb-vector-search.md`,
  `docs/adr/0010-retrieval-profile.md`
