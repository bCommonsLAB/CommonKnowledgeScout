---
name: shadow-twin-verify
description: Verifiziere die Shadow-Twin-Reparatur (Sync-Engine, Wellen 5a-5d) agentengetrieben — Legacy-Fixtures anlegen, Engine im check-Modus pruefen, Presets (repair/import/export) vergleichen, optional echte Reparatur mit Mongo-Verifikation, danach alles aufraeumen. Verwende diesen Skill, wenn der Benutzer die Reparatur/Namens-Migration/den Import "pruefen", "verifizieren" oder "lokal testen" will.
---

# Shadow-Twin-Reparatur verifizieren (Wellen 5a-5d)

Prueft die konsolidierte Sync-Engine end-to-end gegen eine LOCAL-Library der
Dev-DB — ohne Login, direkt gegen `runLibrarySync` (derselbe Code wie die
Buttons in Einstellungen → Erweitert). Grundlage: das erprobte Vorgehen aus
der 5c/5d-Verifikation (2026-08-10) und
[docs/guides/verification-playbook.md](../../../docs/guides/verification-playbook.md).

## Sicherheitsregeln (IMMER)

1. **Read-only zuerst**: Standard ist `mode:'check'` — es wird NICHTS geschrieben.
2. **`--apply` nur auf die Fixture-Quelle** (das Skript beschraenkt den Scope auf
   den Library-Root, non-recursive, und raeumt Storage UND Mongo wieder auf).
   NIE eine ganze echte Library reparieren, ausser der User beauftragt es
   explizit — dann vorher `mongodump` der Collection (Playbook §5).
3. **Nur Dev-DB**, nie die Prod-DB. Das Skript bricht ab, wenn
   `MONGODB_DATABASE_NAME` nach Prod aussieht (Suffix `-prod` oder gleich
   `MONGODB_DATABASE_NAME_PROD`). Zeigt die `.env` gerade auf Prod, Dev
   explizit erzwingen (Prozess-Env schlaegt .env):
   `MONGODB_DATABASE_NAME=common-knowledge-scout pnpm tsx …`
4. Fixtures IMMER aufraeumen (das Skript macht das in `finally`; bei Abbruch
   pruefen: `<library.path>\welle5-verify-fixture.pdf` + `_welle5-verify-fixture.pdf\`).

## Voraussetzungen

- `.env` im Arbeitsverzeichnis (Worktrees erben sie nicht — vom Hauptprojekt
  kopieren) und `pnpm install` gelaufen.
- Eine **LOCAL**-Library mit gesetztem Standard-Template
  (`config.secretaryService.template`) — ohne Template plant die Engine statt
  Renames nur Konflikt-Befunde. Kandidaten finden:

```bash
pnpm tsx scripts/list-libraries.ts
```

  (Bekannt gut in der Dev-DB: „Klimamassnahmen" von peter.aichner@crystal-design.com.)

## Ablauf

### Schritt 1: Fixture-Check (read-only, Pflicht)

```bash
pnpm tsx .claude/skills/shadow-twin-verify/verify-fixture.ts --libraryId=<id> --email=<owner>
```

Das Skript legt Legacy-Fixtures an (Muster A: `{base}.{lang}.md` MIT
Frontmatter; Muster B: Kombi-`{base}.md`; Alt-Transkript OHNE Frontmatter),
faehrt `check` mit den Presets `repair` und `import` und prueft:

| Erwartung | Preset |
|---|---|
| `migrate-legacy-artifact-name` geplant + selected, Ziel `{base}.{template}.{lang}.md` | repair |
| `split-combined-artifact` geplant + selected (Original bleibt Transkript) | repair |
| `legacy-transcript-name` geplant, NIE selected (report-only) | beide |
| `adopt-storage-only-source` selected (zaehlt Migrations-Ziele mit) | beide |
| Rename/Split NICHT selected (Import schreibt nie ins Storage) | import |

Danach entfernt es die Fixtures wieder. Exit-Code 0 = alle Erwartungen erfuellt.

### Schritt 2: Echte Reparatur der Fixture (optional, schreibt!)

```bash
pnpm tsx .claude/skills/shadow-twin-verify/verify-fixture.ts --libraryId=<id> --email=<owner> --apply
```

Zusaetzlich zu Schritt 1: fuehrt `repair` aus und verifiziert nach
Playbook-Goldstandard —
**Storage**: umbenannte/aufgeteilte Dateien existieren, der Legacy-Name ist weg;
**MongoDB (read-only)**: Transkript-Record und Transformations-Slots sind
NICHT leer (Guard gegen Leer-Upserts). Danach loescht es das
Mongo-Dokument der Fixture-Quelle UND die Dateien.

### Schritt 3: Bestands-Check echter Libraries (read-only)

```bash
pnpm tsx scripts/reconcile-shadow-twins.ts --libraryId=<id> --email=<owner>
```

Auf 2-3 LOCAL-Libraries laufen lassen (Gegenprobe: keine falschen
Rename-/Split-Plaene auf sauberen Bestaenden; `errors` muss 0 sein).
`--preset=import` prueft die Import-Auswahl auf echtem Bestand.

### Schritt 4: UI-Sichtpruefung (5d)

Dev-Server starten (launch.json `next-dev-3001`), `/settings/advanced` oeffnen.
Ohne Login ist nur die Seitenstruktur pruefbar („Prüfen & Reparieren"-Karten
rendern); den Klick-Test (Prüfen → Report; Disclosure zeigt „Aus Dateisystem
laden" + „Ins Dateisystem exportieren") macht der User eingeloggt selbst —
Agenten duerfen keine Passwoerter eingeben.

## Ergebnis-Bericht an den User

Pro Schritt: PASS/FAIL + die `planned`/`selected`-Zaehler, bei FAIL die
konkreten Operationen der Fixture-Quelle. Abweichungen NIE stillschweigend
tolerieren — sie sind Befunde (no-silent-fallbacks gilt auch fuer Tests).

## Referenzen

- Wellen-Plan: docs/refactor/shadow-twin-sync-konsolidierung/01-bestandsaufnahme-reparatur-redundanzen.md
- Hand-off: docs/handover/2026-08-09-welle-5-reparatur-konsolidierung.md
- Engine: src/lib/shadow-twin/sync-engine/run-library-sync.ts, Presets: src/lib/shadow-twin/sync-plan/allowed-ops.ts
