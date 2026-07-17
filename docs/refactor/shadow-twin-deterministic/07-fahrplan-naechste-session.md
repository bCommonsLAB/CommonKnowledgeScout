# Phase 7 — Fahrplan für die nächste Session (nimmt den alten Plan mit)

Status: HAND-OFF. Branch `claude/shadow-twin-deterministic-plan` (von `master`), PR
[#118](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/118). Diese Datei ist der
Einstieg — sie verlinkt alles Bisherige und sagt, was als Nächstes zu tun ist.

---

## 1. Was funktioniert (verifiziert)

- **Der Overwrite-Bug ist behoben:** Lesen/Öffnen schreibt nichts mehr (0 Writes, mehrfach in Logs bestätigt).
- **Auswahl deterministisch:** „vollständigster gewinnt" in resolve/reconstruct/sync.
- **Reparatur funktioniert end-to-end:** `_Ökoniomie_en_Innen.pdf` repariert (Transkript 908 → 28.888 Z. / 20 Seiten,
  per-Seite-`.md` aufgeräumt, 40 Bilder als Mongo-Fragmente registriert) — via UI-Button bzw. CLI.
- 134 Shadow-Twin-Unit-Tests grün; `next lint` + `tsc` (geänderte Dateien) sauber.

## 2. Doc-Map (der „alte Plan", mitgenommen)

- `00-plan.md` — Gesamtplan (Ziel, Leitprinzipien, Phasen 0–5, Storage-Contract-Verweis).
- `01-trace-open-dir.md` / `02-trace-open-file.md` — Phase-0-Baseline (Öffnen-Traces).
- `03-audit.md` — alle Auflöse-/Schreibpfade + Entscheidung je Pfad.
- `04-zielmodell.md` — kanonischer Resolver + **§9 Storage-Contract** (kanonisch `{base}.md`, „vollständigster gewinnt", Löschen).
- `06-optimierungsplan.md` — **Re-Trace-Befunde + priorisierte Optimierungen (A1/B1–B4)** ← hier weitermachen.
- Memory `shadow-twin-storage-sync-vision` — **Endziel-UX** (1 Button, Klartext).

## 3. Endziel (Storage-sync-Vision)

EIN Button **„Mit Speicher synchronisieren"** pro Datei UND pro Library, der ALLES macht
(Transkript „vollständigster gewinnt", per-Seite-`.md` aufräumen, Bilder registrieren). **Nutzer ist
kein Programmierer** → Klartext, keine Reparatur-/Konflikt-/Reconcile-Begriffe, keine Datei-Listen-Dialoge.

## 4. Offene Arbeit, priorisiert (aus 06)

1. **A1 (Korrektheit, zuerst):** `selectShadowTwinArtifact` (`src/lib/shadow-twin/shadow-twin-select.ts`)
   exakt nach (kind, targetLanguage, templateName) matchen — **kein stiller Cross-Sprach-/Template-Fallback**.
   Heute liefert `targetLanguage=en` oft `selectedLang=de` / `meeting_analyse-de`. + Unit-Tests.
2. **B2 (Perf, klein/groß):** StorageFactory-Provider-Cache-Key fixen — heute `cachedLibraryPath: 'nicht verfügbar'`
   → Provider ~43×/Verzeichnis neu gebaut. (`src/lib/storage/storage-factory.ts`.)
3. **B1 + Storage-sync-Konsolidierung:** Reconcile (`reconcile-library.ts`) zusätzlich Bilder registrieren
   (`reconstructPageImages` einhängen) → ALLE Quellen bekommen Fragmente in EINEM Lauf. Dann 1 Button-UX
   (Übersicht-Button + per-Library), Klartext.
4. **B3 (Perf):** `resolve-binary-url` / `binary-fragments` batchen + parallelisieren (`Promise.all`).
5. **B4:** `batch-resolve`-Regression (5→9 s) profilen.

## 5. Umgebung & Effizienz-Lehren (damit es nicht zäh wird)

- **CLI-Runner statt Browser-Klicken:** `pnpm tsx scripts/reconcile-shadow-twins.ts --libraryId=<id> --email=<owner>`
  (Dry-Run, read-only) bzw. `--apply`. Schneller + zuverlässiger als die UI für Tests/Reparatur.
- **Große Server-Logs per Subagent auswerten** (preview_logs überschreitet das Token-Limit → wird in Datei
  gespeichert → Subagent liest + fasst zusammen). Nicht selbst zeilenweise lesen.
- **Chrome-Extension bricht bei der Datei-Vorschau** (PDF-Viewer) den Debugger-Attach → für Datei/Tab-Traces
  auf **Server-Logs** verlassen; Verzeichnis-Ebene geht per Extension.
- **mongosh/mongodump:** `C:\Program Files\mongosh-2.8.3-win32-x64\bin\mongosh.exe`,
  `C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe`. DB = `MONGODB_DATABASE_NAME` (dev `common-knowledge-scout`).
- **Vor jedem `--apply`: mongodump** der Collection (Backups bisher in `tmp/`, gitignored).
- Tamera: libraryId `bf29edda-fdc3-4ac0-ae54-90133c2e1517`, Ökoniomie sourceId `QXJ0aWNsZXMvX8OWa29uaW9taWVfZW5fSW5uZW4ucGRm`.
- ⚠️ **Security (separat):** Storage-Credentials (Nextcloud-appPassword) liegen im Klartext in der Library-Config — verschlüsseln/maskieren.

## 6. Aufsetzen (neue Session)

```bash
git fetch origin
git checkout claude/shadow-twin-deterministic-plan
git pull
pnpm install --frozen-lockfile   # falls nötig
```

## 7. Start-Prompt (kopierbar)

> Lies `docs/refactor/shadow-twin-deterministic/07-fahrplan-naechste-session.md` und `06-optimierungsplan.md`.
> Wir setzen die Shadow-Twin-Optimierung fort. Beginne mit **A1**: `selectShadowTwinArtifact` so fixen,
> dass es exakt nach (kind, targetLanguage, templateName) matcht — kein stiller Cross-Sprach-/Template-Fallback
> (heute liefert `targetLanguage=en` ein deutsches/falsches Template). Mit Unit-Tests, `pnpm test` + `pnpm lint`.
> Danach **B2** (Provider-Cache-Key) und die **Storage-sync-Konsolidierung** (1 Button „Mit Speicher
> synchronisieren", Klartext, pro Datei + pro Library; Bilder gleich mitregistrieren). Nutze den CLI-Runner
> `scripts/reconcile-shadow-twins.ts` für Dry-Runs statt Browser-Klicken; große Logs per Subagent auswerten.
> Vor jedem `--apply`: mongodump.
