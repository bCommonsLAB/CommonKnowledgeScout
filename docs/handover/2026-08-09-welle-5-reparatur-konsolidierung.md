# Hand-off 2026-08-09: Welle 5 — Reparatur-Konsolidierung („Aus Alt mach Neu")

Basis-Session: Live-Test + Legacy-Migration Umweltarchiv (2026-08-07 … 08-09).
Pflicht-Lektüre vor Start:
1. [01-bestandsaufnahme-reparatur-redundanzen.md](../refactor/shadow-twin-sync-konsolidierung/01-bestandsaufnahme-reparatur-redundanzen.md) (Befund + Wellen-Plan)
2. [00-design-vorschlag.md](../refactor/shadow-twin-sync-konsolidierung/00-design-vorschlag.md) (Welle-4-Design: EIN Plan, zwei Modi)
3. `.cursor/rules/shadow-twin-contracts.mdc`, `no-silent-fallbacks.mdc`

## 1. Ziel (User-Entscheid, wörtlich)

> Eine veraltete Library auch mit Dateien aus dem Filesystem rekonstruieren,
> reparieren und als aktuell gültige Namenskonvention speichern. So als hätte
> ich die Library gerade eben erstellt. Einfach aus Alt mach Neu.

Gleiche Funktion = Wiederherstellung einer Library, die nur im Filesystem
„überlebte"/weitergegeben wurde und in einer **anderen Instanz** aktiviert wird.
Konsequenz: Der Ablauf darf sich NIE auf vorhandene Mongo-Einträge oder alte
sourceIds verlassen — Storage allein muss genügen (IDs sind instanzspezifisch).

Ziel-UX: EIN Flow pro Library — „Prüfen → Report → Reparieren" — der Cache,
Filesystem UND Dateinamen analysiert und Fehlendes repariert.

## 2. Ist-Zustand (Kurzfassung, Details in Doc 01)

- DREI Reparatur-Logiken: (A) Sync-Engine `/reconcile` (Mongo-getrieben),
  (B) `/migrate` „Aus Dateisystem laden" (Storage gewinnt bedingungslos),
  (C) `/reconstruct` + Lazy-Resolve (pro Quelle). Vier Mongo-Schreibpfade.
- Bekannte Bugs (live verifiziert):
  1. Transkript-Guard verwirft kanonisches `{base}.md` (targetLanguage null):
     `reconstruct-from-storage.ts:160`, `migrate/route.ts:154`; Engine-Collect prüfen.
  2. C spiegelt `page_*/preview_*` nur, wenn ≥1 Markdown übernommen wurde
     (`reconstruct-from-storage.ts:233`).
  3. C-Writer erzeugt OneDrive „Name already exists" (Upload statt Update,
     `provider-shadow-twin-store.ts:126` → `onedrive-provider.ts:1648`).
  4. 3× `register-image-fragments` im Engine-Repair fehlgeschlagen, Ursache
     offen (kein Log-Detail) — beim Umbau Logging nachrüsten.
- Legacy-Namenskonventionen (im Umweltarchiv bereits per Skript migriert,
  andere Libraries können sie noch haben):
  - Muster A: `{base}.{lang}.md` MIT Frontmatter = alte Transformation
    → umbenennen in `{base}.{template}.{lang}.md`
  - Muster B: EINE `{base}.md` mit Transformations-Frontmatter + Transkript-Body
    (Kombi-Datei) → kopieren als Transformation, Original bleibt Transkript
  - `{base}.{lang}.md` OHNE Frontmatter = altes Transkript (nur melden)
  - Template-Name steht NICHT in alten Dateien → aus Library-Config ableiten
    (Umweltarchiv: `pdfanalyse-umweltarchiv`); nicht ableitbar ⇒ Report-Befund.
- OneDrive-Pfadlimit: 400 Zeichen inkl. ~53 Zeichen Site-Präfix
  (`/personal/<upn>/Documents/`) → Budget ≈ 347–358 rel. Zeichen. Eine zu
  lange Datei blockiert per Modal-Dialog die GESAMTE Sync-Warteschlange
  (Live-Erfahrung!). Vor jeder geplanten Umbenennung Budget prüfen.

## 3. Wellen-Schnitt (je EINE PR, ≤5.000z brutto, ≤1.000z/Commit)

### Welle 5a — Engine storage-vollständig (Kern)
- `resolveSources` (run-library-sync.ts): Ordner-/Library-Scope adoptiert
  Quellen OHNE Mongo-Doc (neue Op-Klasse `adopt-storage-only-source`;
  Artefakt-Sammlung aus migrate/route.ts `collectArtifactsForSource` in die
  Engine ziehen). Library-Scope zusätzlich storage-getrieben machen (Root-Scan)
  oder Ordner-Scope=Root als dokumentierter Weg.
- Transkript-Guard-Fix an ALLEN Stellen (transcript ⇒ targetLanguage null ok).
- Unit-Tests Plan-Schicht; Live-Verifikation: Engine-`check` Umweltarchiv muss
  ~900 Quellen mit `adopt`-Ops zeigen (heute: 6).

### Welle 5b — C auf Engine
- „Alle Artefakte aus Storage übernehmen" + Lazy-Resolve → `/reconcile`
  `scope:{sourceIds}`; Bugs 2+3 verschwinden mit (Bild-Registrierung wird
  Engine-Op, Writer wird Engine-Executor). `reconstruct-from-storage.ts` auf
  Bausteine reduzieren.

### Welle 5c — Namens-Migration in den Plan („Aus Alt mach Neu")
- Neue Befund-/Op-Klassen: `migrate-legacy-artifact-name` (Muster A),
  `split-combined-artifact` (Muster B), `legacy-transcript-name` (report-only),
  `path-too-long` (report-only, Budget konfigurierbar mit Default 347).
- Rename/Split nur im Repair, nur wenn Ziel-Pfad im Budget; Template aus
  Library-Config, sonst Report. Frontmatter-Erkennung: erste Zeile `---`.

### Welle 5d — UI: EIN Button
- Settings: Primär-Flow „Prüfen → Report → Reparieren" (Engine, jetzt
  vollständig). „Aus Dateisystem laden" wird Engine-Preset `import` in der
  Disclosure; migration-writer entfällt. Dokument-Angaben-Karte bleibt
  (andere Domäne), gleicher Report-Stil.

## 4. Test-Setup (User-Wunsch: Umweltarchiv als Testbett)

- Library `a5341586-3124-4b80-a4da-6022f2902910` „Umweltarchiv (onedrive)".
- Stand: 963 Legacy-Dateien sind bereits auf neue Namen migriert und
  cloud-synchron; Mongo kennt nur ~6 Quellen → perfekter 5a-Akzeptanztest:
  Repair muss ~900 Quellen adoptieren (Transkript + Transformation + Bilder),
  danach zeigt die Archiv-Übersicht Phase 1+2 für Alt-Dokumente.
- Für 5c-Tests (Namens-Migration) Legacy-Fixtures anlegen (z. B. Test-Ordner
  mit Muster A/B), da das Umweltarchiv bereits umbenannt ist.
- Verifikation IMMER lesend zuerst (`mode:'check'`), MongoDB read-only =
  Goldstandard (vgl. Memory „Live-Verifikation"). Dev-Server-Logs: FileLogger.
- Worktree-Gotcha: `.env` + `pnpm install` je Worktree nötig; Port 3001 ⇒
  auch `NEXT_PUBLIC_APP_URL` overriden.

## 5. Hand-off-Block (Pflichtformat)

1. **Pre-Merge lokal:** `bash scripts/welle-pre-merge-check.sh`
2. **Nächste Welle:** 5a „Engine storage-vollständig", Branch
   `cursor/refactor-welle-5a-engine-storage-vollstaendig-<suffix>`,
   Brief: dieses Dokument §3/5a + Doc 01 §4.
3. **Modell:** Opus (bzw. Fable) mit hohem Thinking für 5a (Plan-Schicht,
   Konflikt-Semantik, Tests); 5b/5c Opus normal; 5d Sonnet möglich (UI).
4. **Agent-Typ:** NEUER Agent (Default) — Kontext steckt vollständig in
   Doc 01 + diesem Hand-off; keine Session-Altlast nötig.
5. **Start-Prompt:** siehe unten.
6. **Kosten-Schätzung:** 5a ≈ 10–20 USD (Engine + Tests + Live-Check),
   5b ≈ 5–10, 5c ≈ 10–15 (neue Op-Klassen + Fixtures), 5d ≈ 5–10.
   Kein `pnpm build` im Cloud-Agent (nur `pnpm test` + `pnpm lint`).

### Start-Prompt (kopierbar)

```
Lies zuerst docs/handover/2026-08-09-welle-5-reparatur-konsolidierung.md und
docs/refactor/shadow-twin-sync-konsolidierung/01-bestandsaufnahme-reparatur-redundanzen.md
komplett, dazu die alwaysApply-Rules. Setze dann Welle 5a um: Die Sync-Engine
(src/lib/shadow-twin/sync-engine/) muss im Ordner-/Library-Scope Quellen OHNE
Mongo-Doc aus dem Storage adoptieren (neue Operationsklasse
adopt-storage-only-source, Artefakt-Sammlung aus migrate/route.ts
wiederverwenden) und der Transkript-Guard-Bug (kanonisches {base}.md mit
targetLanguage null wird verworfen) ist an allen drei Stellen zu fixen
(reconstruct-from-storage.ts:160, migrate/route.ts:154, Engine-Collect).
Unit-Tests für die neue Planung. Branch
cursor/refactor-welle-5a-engine-storage-vollstaendig-<suffix>, EINE PR,
Diff-Limits beachten. Akzeptanz: reconcile mode:check auf die Library
a5341586-3124-4b80-a4da-6022f2902910 (Umweltarchiv) plant ~900
adopt-storage-only-source-Operationen (heute nur 6 Quellen sichtbar).
```
