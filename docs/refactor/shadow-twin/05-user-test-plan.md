# User-Test-Plan: Welle 2 — Modul `shadow-twin`

Stand: 2026-04-27. Erstellt fuer User-Verifikation NACH dem Cloud-Agent-Lauf.
Bezug: [`06-acceptance.md`](./06-acceptance.md), Playbook R3, Welle-1-Vorbild
[`docs/refactor/storage/05-user-test-plan.md`](../storage/05-user-test-plan.md).

## Ziel

Bevor Welle 2 nach `master` gemerged wird, soll der User lokal verifizieren,
dass die wenigen Code-Aenderungen funktional unauffaellig sind. Welle 2 hat
am Modul `shadow-twin` ausschliesslich pure Helper extrahiert und Tests
ergaenzt — der Risiko-Footprint ist **sehr klein**.

## Was wurde im Code geaendert

| # | Aenderung | Datei | Test-Risiko |
|---|---|---|---|
| 1 | Pure Helper `getFileKind` und `getMimeType` aus `shadow-twin-migration-writer.ts` extrahiert in neue Datei `src/lib/shadow-twin/file-kind.ts`. Aufrufer-Stelle nutzt lokalen Alias, Diff klein. Logik unveraendert. | `src/lib/shadow-twin/file-kind.ts` (neu, +51 Z.), `src/lib/shadow-twin/shadow-twin-migration-writer.ts` (-49/+5 Z.) | sehr gering — Pure Funktion, char-test-gruen mit 15 Tests |
| 2 | 2 neue Char-Test-Files (21 Tests): `file-kind.test.ts`, `mongo-shadow-twin-item.test.ts` | `tests/unit/shadow-twin/` | gering — nur Tests, kein Produktcode geaendert |
| 3 | Neue Cursor-Rule `.cursor/rules/shadow-twin-contracts.mdc` (7 Sektionen) | `.cursor/rules/` | keine — nur Regelwerk |
| 4 | Welle-2-Doku unter `docs/refactor/shadow-twin/` (6 Files) | `docs/refactor/shadow-twin/` | keine — nur Doku |

**Was NICHT geaendert wurde (Folge-PRs):**

- Vollstaendiger Split von `shadow-twin-service.ts` (914 Z.) — Folge-PR
  mit eigenen Char-Tests fuer Service-Verhalten.
- E2E-Tests fuer `analyze-shadow-twin.ts`, `shadow-twin-migration-writer.ts`,
  `artifact-client.ts`, `media-persistence-service.ts`.
- Doku-Aufraeumen `docs/analysis/shadow-twin-*.md` nach `docs/_analysis/`
  (7 Files Move).
- Cross-Reference Update in `external-jobs-integration-tests.mdc`.

---

## Phase A — Automatisierte Tests (5 Min)

Im Projekt-Root:

```powershell
pnpm install
pnpm test
```

**Erwartung:**
- 511/511 Tests gruen (vorher 490, +21 in Welle 2)
- Keine neuen Fehler

```powershell
pnpm lint
```

**Erwartung:** 0 neue Errors. Bestehende Warnings sind erwartet.

```powershell
pnpm health -- --module shadow-twin
```

**Erwartung:**
- Files: 31 (vorher 30)
- Max-Zeilen: 915 (unveraendert — `shadow-twin-service.ts`-Split ist Folge-PR)
- > 200 Zeilen: 12 (unveraendert)
- Leere Catches: 0 (war schon)

---

## Phase B — Build-Sanity-Check (3 Min)

```powershell
pnpm build
```

**Erwartung:** Build laeuft durch, keine TypeScript-Fehler, kein
"Module not found" auf den neuen `file-kind.ts`-Pfad.

---

## Phase C — Lokale UI-Smoke-Tests (10-20 Min)

App lokal starten:

```powershell
pnpm dev
```

Fokus: alles, was Shadow-Twin-Migration und Cover-Bilder triggert. Da Welle 2
nur Helper extrahiert hat, sind die Pfade indirekt:

| # | UseCase | Szenario | Warum dieser Test? | Kategorie |
|---|---|---|---|---|
| 1 | PDF mit Cover-Bild | PDF in Filesystem-Library hochladen, Pipeline durchlaufen lassen, Cover-Bild generieren | Triggert `persistShadowTwinFilesToMongo` indirekt → nutzt `getFileKind`/`getMimeType` aus Helper | **MUSS gruen** |
| 2 | Audio mit Transkription | Audio-Datei in Filesystem-Library hochladen, Transkript durchlaufen lassen | Triggert `analyze-shadow-twin.ts` und `shadow-twin-service.ts` (unveraendert) | **MUSS gruen** |
| 3 | Galerie oeffnen mit Cover-Thumbnails | Library mit bereits transformierten Inhalten oeffnen, Galerie-View | Pruefe ob Cover-URLs funktionieren (frontmatter coverImageUrl/coverThumbnailUrl) | sollte gruen |
| 4 | Mongo-Shadow-Twin Library wechseln (falls verfuegbar) | Library mit `primaryStore=mongo` oeffnen, Datei oeffnen | Triggert `buildMongoShadowTwinItem` (jetzt char-getestet) | sollte gruen |
| 5 | Source mit `.txt`/`.mdx`/exotischer Endung | Datei mit ungewohnter Endung hochladen | Triggert `getFileKind` mit Edge-Case | nice-to-have |

**Minimales Smoke-Set** (5 Min): nur Test 1 (PDF mit Cover).

### Was bei Failure beobachten

- **Build-Failure** (Phase B) → ist der neue Pfad `@/lib/shadow-twin/file-kind`
  korrekt aufloesbar? `pnpm build` lokal pruefen.
- **Migration-Failure** (Test 1) → ist der Helper-Alias-Wrapper in
  `shadow-twin-migration-writer.ts` korrekt? Pruefe ob beide
  `getFileKind` und `getMimeType` aufrufbar sind.
- **Test-Failure** (Phase A) → vermutlich CRLF/LF-Konflikt durch
  Windows-Linebreaks. `git config --global core.autocrlf input` oder
  `pnpm test --no-watch` mit `--reporter=verbose`.

Ergebnis dokumentieren wie in Welle 1.

---

## Phase D — Befund konsolidieren

### Option 1: Alles gruen → Welle 2 abgenommen

- Acceptance-Bericht (`06-acceptance.md`) bleibt wie ist
- Naechste Welle (`external-jobs-worker` oder Plan §5 Welle 3) starten
- Folge-PRs in den Backlog

### Option 2: Failures, aber bekannt

- Befund in `05-user-test-plan.md` ergaenzen
- Welle als "best effort verifiziert" markieren

### Option 3: Echte Regression

- Konkreter Test + Stack-Trace in eine Mini-Welle "Welle 2 Hotfix"
- Lokal testen, push erst nach OK
