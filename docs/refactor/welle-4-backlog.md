# Welle-4 Backlog: Doku-Lücken & Refactoring (abarbeitbar)

**Stand:** 2026-06-01 · **Quelle:** [welle-4-retrospektive.md](./welle-4-retrospektive.md)
(datenbasierter Codebase-Scan).

Für die **nächste Session** gedacht: jeder Punkt hat *Warum (Beleg)*, *Wo*,
*Aufwand* und *Akzeptanz*. Reihenfolge = Priorität. **P0 zuerst** — billig und
verhindert ganze Bug-Klassen. Pro Eintrag möglichst eigener Commit; bei größeren
(P2) eigene Session laut R-W4-1.

---

## P0 — Bug-Klassen verhindern (billig, hoher Hebel)

### [B1] DocCardMeta-Mapper: Paritäts-Test + Vereinheitlichung
- **Warum:** Zwei unabhängige Mapper, **bereits gedriftet** (63 vs. 59 Felder).
  Direkte Ursache des Prio-Index-Bugs (Feld nur in einem ergänzt). Nichts
  erzwingt Parität.
- **Wo:** `src/lib/repositories/doc-meta-formatter.ts:122`
  (`convertMongoDocToDocCardMeta`) ↔ `src/lib/gallery/types.ts:235`
  (`mapItemToDocCardMeta`). Test-Vorbild: `tests/unit/gallery/map-item-to-doc-card-meta.test.ts`.
- **Aufwand:** Test S (1–2 h), Vereinheitlichung M.
- **Akzeptanz:** Vitest-Test schlägt rot fehl, wenn ein Feld nur in *einem*
  Mapper existiert. Idealziel: gemeinsamer Feld-Projektor, beide Mapper rufen ihn.

### [B2] Cover-Bild-Lebenszyklus dokumentieren
- **Warum:** Cover liegt in `docMetaJson` (nicht Top-Level), wird per `$set`
  ersetzt → bei Re-Transform still gelöscht. Der Erhaltungs-Contract wurde in
  Welle 4 erst etabliert (zwei Carry-Forwards), ist aber nirgends beschrieben.
- **Wo:** neu `docs/architecture/cover-image-lifecycle.md`. Inhalt: Generierung
  (`phase-template.ts` ~1778), Speicherorte (Frontmatter vs. `docMetaJson` vs.
  toter Top-Level), Carry-Forward in `phase-template.ts` (~1313) **und**
  `ingestion-service.ts` (vor `buildMetaDocument`). Verlinken mit bestehender
  [`cover-image-deterministic-flow/`](./cover-image-deterministic-flow/).
- **Aufwand:** S.
- **Akzeptanz:** Doc erklärt, warum zwei Schreibpfade nötig sind + wann Cover neu
  generiert vs. bewahrt wird.

### [B3] Cover-Erhaltung als Regressionstest absichern
- **Warum:** **Null** Tests für Cover-Erhaltung; der Bug war live in Produktion.
- **Wo:** neu unter `tests/unit/external-jobs/` bzw. `tests/unit/ingestion/`.
  Fall: Re-Transform ohne neues Cover → bestehendes `coverImageUrl`/
  `coverThumbnailUrl` bleibt erhalten.
- **Aufwand:** S–M (Mock `getMetaByFileId`).
- **Akzeptanz:** Test wird rot, wenn man den Carry-Forward entfernt.

---

## P1 — Bestätigte Hotspots refaktorieren + Hygiene

### [R1] `$set`-Full-Replace von `docMetaJson` → Preserve-Contract
- **Warum:** Wurzel der „Felder verschwinden still"-Klasse. `$set: doc` ersetzt
  `docMetaJson` komplett.
- **Wo:** `src/lib/repositories/vector-repo.ts:661` (`upsertVectorMeta`).
- **Aufwand:** M (Risiko: viele Aufrufer).
- **Akzeptanz:** Dokumentierte Merge-/Preserve-Semantik *oder* explizite
  „diese Felder bleiben erhalten"-Liste; Test deckt es ab.

### [R2] Cover-Auflösung aus `ingestion-service.ts` herauslösen
- **Warum:** ~300 Zeilen „PRIORITÄT 0/1/2" + zwei „STUFE"-Azure-Pässe in einer
  1516-Zeilen-Datei; kaum testbar.
- **Wo:** `src/lib/chat/ingestion-service.ts:327/423/488` → neues Modul
  `src/lib/ingestion/cover-resolution.ts` mit reinen, testbaren Funktionen.
- **Aufwand:** M.
- **Akzeptanz:** Cover-Logik in eigenem Modul + Unit-Tests; `ingestion-service`
  ruft nur noch auf.

### [R3] Tote Top-Level-`coverImageUrl`-Projektion klären
- **Warum:** `vector-repo.ts:1050` projiziert Top-Level `coverImageUrl`, aber
  `meta-document-builder.ts` schreibt es nie → `doc-meta-formatter.ts:178` liest
  einen nie befüllten Operand. Irreführend.
- **Wo:** `vector-repo.ts:1050`, `meta-document-builder.ts`, `doc-meta-formatter.ts:178`.
- **Aufwand:** S.
- **Akzeptanz:** Entweder Projektion entfernt *oder* Feld konsistent befüllt.

### [R4] Galerie-Datenfluss-Spec
- **Warum:** Kein Dokument, das MongoDB-Doc → *welcher* Mapper →
  Karte/Tabelle/Detail beschreibt. Hätte Prio-Index-Bug verhindert.
- **Wo:** neu `docs/architecture/gallery-data-flow.md`.
- **Aufwand:** S.
- **Akzeptanz:** Feld-Fluss-Karte inkl. „neues Feld → diese N Stellen anfassen".

### [R5] `console.log`-Aufräumen + ESLint-`no-console`
- **Warum:** **116 `console.log` in `src/components/`** (z. B.
  `gallery-root.tsx:134` loggt Config bei jedem Render). Debug-Code in Produktion.
- **Wo:** `src/components/**`. ESLint-Regel `no-console` (Ausnahme `warn`/`error`).
- **Aufwand:** S–M.
- **Akzeptanz:** 0 nackte `console.log` in `components/`; Lint erzwingt es.

### [R6] Audit der 157 leeren catch-Blöcke
- **Warum:** **157 leere `catch {}`** — direkter Widerspruch zur eigenen
  `no-silent-fallbacks`-Regel; verstecken Fehler.
- **Wo:** projektweit (Lint meldet sie bereits als `no-empty`-Warnungen).
- **Aufwand:** M (priorisiert: erst Schreibpfade/Storage/Ingestion).
- **Akzeptanz:** Jeder verbleibende leere Catch hat einen Kommentar *warum*
  ignoriert wird; Rest loggt mindestens.

### [R7] Checkliste `library-config-field.mdc` ergänzen
- **Warum:** Führt offenbar nicht „beide DocCardMeta-Mapper" + „Schreibpfade",
  sonst wäre der Bug nicht passiert.
- **Wo:** `.cursor/rules/library-config-field.mdc`.
- **Aufwand:** XS.
- **Akzeptanz:** Checkliste nennt beide Mapper + `buildMetaDocument` + Projektion.

---

## P2 — Strukturell (je eigene Session, R-W4-1)

### [S1] Mega-Dateien zerlegen (Top-Verursacher)
- **Warum:** Regel „max. 200 Zeilen" — Realität: **315 Dateien > 200, 23 > 1000**.
  Größte: `creation-wizard.tsx` **4219**, `structured-template-editor.tsx` 2259,
  `job-report-tab.tsx` 2221, `phase-template.ts` 2165, `onedrive-provider.ts` 2134,
  `jobs/[jobId]/start/route.ts` 2112, `vector-repo.ts` 1940, `file-list.tsx` 1646.
- **Aufwand:** je L. **Nicht alle auf einmal** — pro Session eine Datei,
  Tests-vor-Refactor (Playbook).
- **Akzeptanz:** Zielmodul < ~400 Zeilen, Verhalten unverändert (Tests grün).

### [S2] Integrationstest für Naht Transform → Ingestion
- **Warum:** 1676 Unit-Tests, aber **keiner** an den Nähten, wo die echten Bugs
  saßen (Mapper-Parität, Cover-/Feld-Erhaltung, `upsertVectorMeta`). „Grün" gibt
  falsche Sicherheit.
- **Wo:** `tests/` (ggf. `integration-test`-Skill nutzen).
- **Aufwand:** L.
- **Akzeptanz:** Re-Transform-Szenario testet Feld-Erhaltung end-to-end.

### [S3] 200-Zeilen-Regel ehrlich machen
- **Warum:** Eine ignorierte Regel untergräbt alle Regeln.
- **Wo:** `AGENTS.md` / `.cursorrules`.
- **Aufwand:** XS.
- **Akzeptanz:** Formuliert als „neue Dateien ≤ 200; Bestand wird beim Anfassen
  gesplittet" + optional Lint-Warn-Schwelle für *neue* Dateien.

---

## Weitere Marker (Kontext, nicht eingeplant)
- 29× `TODO/FIXME/HACK`, 155× `eslint-disable`, 8× `any`-Loch, 1× `@ts-ignore`.
- Bei Gelegenheit beim Anfassen der jeweiligen Datei mit-bereinigen.
