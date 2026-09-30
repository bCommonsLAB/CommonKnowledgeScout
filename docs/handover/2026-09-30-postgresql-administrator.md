# Handover Administration: PostgreSQL für KnowledgeScout

> Für: Server-Administration. Von: Entwicklung (Owner). Stand: 2026-09-30.
> Hintergrund und Begründung stehen in
> [`docs/analysis/mongodb-zu-postgresql-analyse-und-empfehlung.md`](../analysis/mongodb-zu-postgresql-analyse-und-empfehlung.md).
> Dieses Dokument beschreibt nur, **was auf dem Server zu tun ist**: Installation,
> Konfiguration, Backup, Wartung, Notfall.

## 0. Kontext in fünf Sätzen

KnowledgeScout läuft als Docker-Container (Dokploy, siehe
`docker-compose.example.yml`) und nutzt heute MongoDB Atlas in der Cloud.
Die Datenbank soll auf einen eigenen PostgreSQL-Server auf demselben Host
wechseln. Die Anwendung wird dafür in mehreren Schritten umgebaut; bis zum
Umschalttag bleibt Atlas in Betrieb und darf **nicht** abgeschaltet werden.
PostgreSQL kann ab sofort aufgesetzt werden, damit Entwicklung und Tests
dagegen laufen. Zwei Erweiterungen sind Pflicht: **pgvector** (semantische
Suche) und **PostGIS** (Geodaten, für ein späteres Projekt).

## 1. Was zu installieren ist

| Komponente | Version | Pflicht | Zweck |
|---|---|---|---|
| PostgreSQL | **18.x** (aktuell 18.6) | ja | Datenbank |
| pgvector | **0.8.x** (≥ 0.8.1 für PG 18) | ja | Vektorsuche, Typ `halfvec` |
| PostGIS | **3.6.x** | ja | Geodaten |
| contrib-Module `pg_trgm`, `unaccent`, `citext`, `btree_gin`, `pg_stat_statements` | mit PG 18 | ja | Suche, E-Mail-Vergleich, Indizes, Monitoring |
| pgBackRest | 2.5x | ja (oder Variante B in Abschnitt 4) | Backup mit WAL-Archiv |
| PgBouncer | 1.2x | nein | Erst nötig, wenn mehrere App-Instanzen oder Desktop-Clients direkt verbinden |

**Nicht** installieren: eine separate Vektordatenbank (Qdrant, Weaviate),
Redis, MongoDB lokal. Nichts davon wird gebraucht.

### 1.1 Weg A: Docker (empfohlen, passt zu Dokploy)

Eigenes Image, weil kein offizielles Image PostGIS **und** pgvector enthält:

```dockerfile
# postgres/Dockerfile
FROM postgis/postgis:18-3.6
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18-pgvector \
 && rm -rf /var/lib/apt/lists/*
```

```yaml
# docker-compose.yml (Auszug), im selben Dokploy-Netz wie die App
services:
  postgres:
    build: ./postgres
    restart: always
    shm_size: 1g                      # wichtig für parallele Sorts/Index-Aufbau
    command: >
      postgres -c config_file=/etc/postgresql/postgresql.conf
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD_FILE: /run/secrets/pg_superuser_pw
      POSTGRES_INITDB_ARGS: "--locale-provider=builtin --locale=C.UTF-8 --data-checksums"
    volumes:
      - pgdata:/var/lib/postgresql/data     # eigenes Volume auf SSD
      - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
    networks: [dokploy-network]
    # KEIN "ports:" – die Datenbank ist nur im Docker-Netz erreichbar
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    secrets: [pg_superuser_pw]

volumes:
  pgdata:
secrets:
  pg_superuser_pw:
    file: ./secrets/pg_superuser_pw.txt
networks:
  dokploy-network:
    external: true
```

Zu `POSTGRES_INITDB_ARGS`: `--locale-provider=builtin --locale=C.UTF-8`
nimmt die eingebaute Kollation von PostgreSQL statt der glibc-Kollation.
Damit werden Text-Indizes bei einem Betriebssystem-Update nicht ungültig
(ein bekanntes Problem bei glibc-Upgrades). `--data-checksums` erkennt
Bitfehler auf der Platte.

### 1.2 Weg B: nativ auf Debian/Ubuntu (PGDG-Repository)

```bash
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt install -y postgresql-18 postgresql-contrib-18 \
     postgresql-18-pgvector postgresql-18-postgis-3 pgbackrest
```

Danach gelten dieselben Schritte wie in Abschnitt 2, nur dass `initdb`
bereits gelaufen ist; die Locale kann dann mit
`pg_createcluster --locale C.UTF-8 …` oder beim `CREATE DATABASE` gesetzt werden.

## 2. Ersteinrichtung

### 2.1 Rollen und Datenbank

Drei Rollen, keine davon Superuser im Alltag:

```sql
-- als postgres (Superuser), einmalig
CREATE ROLE ks_owner  LOGIN PASSWORD '<pw1>';            -- Schema-Eigentümer, führt Migrationen aus
CREATE ROLE ks_app    LOGIN PASSWORD '<pw2>';            -- die laufende Anwendung
CREATE ROLE ks_backup LOGIN PASSWORD '<pw3>' REPLICATION; -- pgBackRest / pg_dump

CREATE DATABASE knowledgescout OWNER ks_owner
  ENCODING 'UTF8' LOCALE_PROVIDER builtin LOCALE 'C.UTF-8' TEMPLATE template0;

\c knowledgescout
-- Erweiterungen braucht ein Superuser; einmalig pro Datenbank
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Rechte der Anwendung: Daten ja, Schema-Änderungen nein
GRANT CONNECT ON DATABASE knowledgescout TO ks_app, ks_backup;
GRANT USAGE ON SCHEMA public TO ks_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ks_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ks_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ks_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ks_app;
GRANT pg_read_all_data TO ks_backup;
```

Diese Datei gehört nach `postgres/init/01-roles.sql` (Docker) und wird beim
ersten Start ausgeführt; die Passwörter kommen aus Dokploy-Secrets, nicht in
die Datei im Repo.

**Prüfung:**

```sql
SELECT extname, extversion FROM pg_extension ORDER BY 1;
-- erwartet u. a.: vector 0.8.x, postgis 3.6.x, pg_trgm, unaccent, citext, btree_gin, pg_stat_statements
SELECT '[1,2,3]'::halfvec(3) <=> '[1,2,4]'::halfvec(3);   -- muss eine Zahl liefern
SELECT ST_Distance('SRID=4326;POINT(11.35 46.5)'::geography, 'SRID=4326;POINT(11.16 46.67)'::geography); -- ~24 km
```

### 2.2 `postgresql.conf` (Ausgangswerte für 16 GB RAM, 4 Kerne, SSD)

```ini
listen_addresses = '*'                 # nur im Docker-Netz; keine Port-Freigabe nach außen
max_connections = 60                   # App: 10 pro Instanz; Rest für Wartung/Backup
shared_buffers = 4GB                   # 25 % RAM
effective_cache_size = 12GB            # 75 % RAM
work_mem = 32MB                        # pro Sortierung; nicht höher, weil × Verbindungen
maintenance_work_mem = 2GB             # entscheidend für den Aufbau der Vektor-Indizes
max_parallel_maintenance_workers = 2
random_page_cost = 1.1                 # SSD
effective_io_concurrency = 200
wal_level = replica                    # nötig für pgBackRest/WAL-Archiv
archive_mode = on
archive_command = 'pgbackrest --stanza=ks archive-push %p'
max_wal_size = 2GB
checkpoint_completion_target = 0.9
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
log_min_duration_statement = 500       # ms; langsame Abfragen ins Log
log_checkpoints = on
log_lock_waits = on
log_autovacuum_min_duration = 1000
log_line_prefix = '%m [%p] %u@%d '
timezone = 'UTC'
```

Bei 8 GB RAM die Speicherwerte halbieren. `maintenance_work_mem` darf beim
späteren Import kurzzeitig auf 4 GB, danach zurück.

### 2.3 `pg_hba.conf`

```
# TYPE  DATABASE        USER        ADDRESS          METHOD
local   all             postgres                     peer
host    knowledgescout  ks_app      172.16.0.0/12    scram-sha-256   # Docker-Netz
host    knowledgescout  ks_owner    172.16.0.0/12    scram-sha-256
host    knowledgescout  ks_backup   172.16.0.0/12    scram-sha-256
host    replication     ks_backup   172.16.0.0/12    scram-sha-256
```

Keine `0.0.0.0/0`-Zeile. `password_encryption = scram-sha-256` ist in PG 18
Standard. Wenn Desktop-Clients (Electron-Build) je direkt verbinden sollen,
dann ausschließlich über TLS (`ssl = on`, Zertifikat von Let's Encrypt oder
intern) und eine eigene Rolle; besser ist, dass Desktop-Clients über die
HTTP-API der Instanz gehen. Das ist noch nicht entschieden.

### 2.4 Was die Entwicklung zurückbekommt

- `DATABASE_URL=postgres://ks_app:<pw2>@postgres:5432/knowledgescout`
  (Hostname = Compose-Dienstname) als Dokploy-Secret für die App
- `DATABASE_URL_MIGRATIONS=postgres://ks_owner:<pw1>@postgres:5432/knowledgescout`
  nur für den Migrationsschritt beim Deploy
- Bestätigung, welche Extension-Versionen installiert sind
- Datum des ersten erfolgreichen Restore-Tests (Abschnitt 4.4)

## 3. Ressourcen

| Ressource | Empfehlung | Begründung |
|---|---|---|
| RAM | 8 GB mindestens, 16 GB gut | Vektor-Indizes sollen in den Speicher passen; pro Library mit 5.000 Dokumenten rund 1 GB Daten + Index |
| CPU | 4 Kerne | Index-Aufbau und Facettenzählungen sind CPU-gebunden |
| Platte | SSD/NVMe, eigenes Volume, **3× Datenmenge** frei | Backups, WAL, `VACUUM`, Import mit Kopie |
| Startgröße | 50 GB Volume, Alarm bei 80 % | Wächst mit Libraries und Embeddings |
| Netz | nur Docker-Netz, keine öffentliche Portfreigabe | Datenbank enthält Zugangsdaten zu OneDrive/Nextcloud der Nutzer |

## 4. Backup

**Was in der Datenbank liegt:** alle Metadaten, Embeddings, Jobs,
Nutzerzuordnungen, Kommentare, Library-Konfigurationen inkl. Storage-Secrets.
**Was nicht darin liegt und separat gesichert werden muss:** Quelldateien und
Twin-Ordner auf OneDrive/Nextcloud/Dateisystem, Bilder und Inbox in Azure
Blob. Die Datenbank allein stellt die Anwendung nicht wieder her.

### 4.1 Variante A: pgBackRest (empfohlen)

Voll + differenziell + kontinuierliches WAL-Archiv, Wiederherstellung auf
jeden Zeitpunkt (PITR).

```ini
# /etc/pgbackrest/pgbackrest.conf
[global]
repo1-path=/var/lib/pgbackrest
repo1-retention-full=4          # 4 Vollsicherungen = 4 Wochen
repo1-retention-diff=14
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=<zufällig, außerhalb des Servers notiert>
process-max=2
log-level-console=info
# Offsite: zweites Repo, z. B. S3-kompatibel (Hetzner Object Storage, Backblaze) oder Azure Blob
repo2-type=azure
repo2-azure-account=<konto>
repo2-azure-container=pgbackrest
repo2-azure-key=<key>
repo2-path=/ks
repo2-retention-full=8

[ks]
pg1-path=/var/lib/postgresql/data
pg1-port=5432
pg1-user=postgres
```

```bash
pgbackrest --stanza=ks stanza-create
pgbackrest --stanza=ks check
# Cron (als postgres):
# 0 2 * * 0   pgbackrest --stanza=ks --type=full backup
# 0 2 * * 1-6 pgbackrest --stanza=ks --type=diff backup
```

Im Docker-Weg läuft pgBackRest als Sidecar-Container mit Zugriff auf das
`pgdata`-Volume und Socket, oder auf dem Host, wenn das Volume dort gemountet ist.

### 4.2 Variante B: `pg_dump` täglich (einfacher, kein PITR)

Ausreichend, wenn ein Datenverlust von bis zu 24 Stunden akzeptabel ist.

```bash
# täglich 02:00, als ks_backup
pg_dump -U ks_backup -h postgres -Fc -Z 6 knowledgescout \
  -f /backup/ks-$(date +%F).dump
find /backup -name 'ks-*.dump' -mtime +30 -delete
rclone copy /backup remote:ks-backup   # Offsite
```

Als Container: `prodrigestivill/postgres-backup-local` mit
`SCHEDULE=@daily`, `BACKUP_KEEP_DAYS=30`, `BACKUP_KEEP_WEEKS=8`.

### 4.3 Grundregeln

- **3-2-1:** lokal + Offsite + verschlüsselt. Die Datenbank enthält
  Zugangsdaten Dritter (OneDrive-Tokens, Nextcloud-Passwörter).
- Backup-Alarm: wenn `pgbackrest info` (oder die Dump-Datei) älter als
  36 Stunden ist, Meldung an die Administration.
- **Vor jedem Major-Upgrade und vor dem Umschalttag** eine manuelle
  Vollsicherung.

### 4.4 Restore-Test (Pflicht, monatlich)

```bash
# in eine zweite, leere Datenbank oder einen Wegwerf-Container
pg_restore -U ks_owner -h postgres -d knowledgescout_restoretest -j 2 /backup/ks-<datum>.dump
psql -U ks_owner -d knowledgescout_restoretest -c "SELECT count(*) FROM libraries;"
psql -U ks_owner -d knowledgescout_restoretest -c "SELECT extversion FROM pg_extension WHERE extname='vector';"
```

Mit pgBackRest: `pgbackrest --stanza=ks --delta restore --pg1-path=/restore/test`
und dort einen zweiten Cluster starten. Datum und Ergebnis notieren.

## 5. Wartung

### 5.1 Regelmäßig

| Rhythmus | Aufgabe | Befehl / Hinweis |
|---|---|---|
| täglich (automatisch) | Backup, Backup-Alter prüfen | Abschnitt 4 |
| wöchentlich | Platte, Verbindungen, langsame Abfragen sichten | `df -h`; `SELECT count(*) FROM pg_stat_activity;`; `SELECT calls, mean_exec_time, query FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;` |
| monatlich | Minor-Update PostgreSQL 18.x (Image neu bauen, Neustart 10 s) | Minor-Updates sind binärkompatibel, kein Dump nötig |
| monatlich | Restore-Test | Abschnitt 4.4 |
| monatlich | Extension-Updates prüfen | `SELECT name, default_version, installed_version FROM pg_available_extensions WHERE installed_version <> default_version;` dann `ALTER EXTENSION vector UPDATE;` |
| quartalsweise | Index-Bloat und Tabellenwachstum | `SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) FROM pg_class WHERE relkind='r' ORDER BY pg_total_relation_size(oid) DESC LIMIT 15;` |
| jährlich | Major-Upgrade (18 → 19) | Erst 6 Monate nach Erscheinen; `pg_upgrade --link` oder Dump/Restore; vorher prüfen, dass pgvector und PostGIS für die neue Version gebaut sind |

### 5.2 Besonderheiten dieser Anwendung

- **Vektor-Indizes (HNSW)** werden pro Library von der Anwendung angelegt
  (DDL beim ersten Zugriff, wie heute die Atlas-Indizes). Der Aufbau eines
  Index für 200.000 Chunks dauert mit `maintenance_work_mem = 2GB` wenige
  Minuten; mit zu kleinem Wert Stunden. Bei Meldungen wie „hnsw graph no
  longer fits into maintenance_work_mem“ den Wert erhöhen.
- **Autovacuum** auf der Chunk-Tabelle (viele Upserts bei jeder
  Neu-Ingestion) aggressiver stellen, sobald die Tabelle existiert:
  ```sql
  ALTER TABLE doc_chunks SET (autovacuum_vacuum_scale_factor = 0.05,
                              autovacuum_analyze_scale_factor = 0.02);
  ```
- **Ingestion-Läufe** (Entwicklung stößt sie an) erzeugen viel WAL. Bei
  Variante A wächst das Backup-Repo in diesen Stunden sichtbar; das ist
  normal. `max_wal_size` bei Bedarf auf 4 GB.
- **PostGIS** wird zunächst ohne Tabellen installiert. Kein Wartungsaufwand,
  bis das Geo-Projekt Daten anlegt.
- **Job-Worker** mehrerer App-Instanzen teilen sich die Datenbank
  (`JOBS_WORKER_POOL_ID`). Beim Skalieren der App `max_connections` um
  10 pro Instanz erhöhen oder PgBouncer (Transaction-Pooling) vorschalten.
- **Nichts manuell in den Tabellen ändern.** Schema-Änderungen kommen
  ausschließlich über die Migrationen der Anwendung (`ks_owner`).

### 5.3 Monitoring-Minimum

- Platte unter 20 % frei → Alarm
- `pg_isready` fehlgeschlagen → Alarm (Dokploy-Healthcheck)
- Backup älter als 36 h → Alarm
- Verbindungen über 80 % von `max_connections` → Hinweis
- Optional: `postgres_exporter` + Prometheus/Grafana, wenn ohnehin vorhanden

## 6. Notfall-Runbook

| Symptom | Erste Prüfung | Maßnahme |
|---|---|---|
| App meldet „connection refused“ | `docker logs postgres`, `pg_isready` | Container neu starten; bei „could not open file“ oder Checksummenfehler: **nicht** weiter starten, Restore aus Backup |
| „too many connections“ | `SELECT usename, state, count(*) FROM pg_stat_activity GROUP BY 1,2;` | Hängende Sitzungen beenden: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle' AND state_change < now() - interval '1 hour';` dann App-Pool prüfen |
| Platte voll | `df -h`, größte Tabellen (5.1) | WAL-Archiv prüfen (`archive_command` fehlgeschlagen → WAL staut sich); alte Backups rotieren; **nie** Dateien in `pg_wal/` von Hand löschen |
| Langsame Galerie/Chat | `pg_stat_statements` Top-20 | An die Entwicklung mit den Abfragen; meist fehlt ein Index oder `hnsw.ef_search` |
| Versehentliches Löschen von Daten | Zeitpunkt eingrenzen | Variante A: `pgbackrest restore --type=time --target="<Zeit>"` in einen zweiten Cluster, betroffene Tabellen per `pg_dump -t` zurückkopieren |
| Nach OS-Update: Indizes „corrupt“ | `SELECT datcollate FROM pg_database;` | Bei `builtin C.UTF-8` nicht betroffen; sonst `REINDEX DATABASE knowledgescout;` |

## 7. Ablauf bis zum Umschalttag

1. **Jetzt:** PostgreSQL nach Abschnitt 1 und 2 aufsetzen, Backup nach 4
   einrichten, Restore-Test einmal durchführen, `DATABASE_URL` an die
   Entwicklung geben.
2. **Während des Umbaus (Wochen):** Die App nutzt Atlas **und** PostgreSQL
   parallel, Domäne für Domäne. Beide müssen erreichbar sein; nichts an
   Atlas ändern.
3. **Umschalttag (von der Entwicklung terminiert):** Wartungsfenster von
   einigen Stunden. Vorher Vollsicherung beider Datenbanken; die
   Entwicklung fährt den Import; danach `VACUUM ANALYZE` und Prüfung.
4. **Danach:** Atlas noch 30 Tage read-only halten, dann kündigen.
   `MONGODB_*`-Variablen aus Dokploy entfernen.

## 8. Rückfragen und Zuständigkeit

- Konfigurationsdateien (`postgres/Dockerfile`, `postgresql.conf`,
  `init/*.sql`) gehören ins Deploy-Repository der Administration, nicht in
  dieses Anwendungs-Repo; Passwörter nur in Dokploy-Secrets.
- Änderungen an Version, Erweiterungen oder `max_connections` bitte der
  Entwicklung mitteilen, weil die Anwendung Pool-Größe und Index-Parameter
  darauf abstimmt.
