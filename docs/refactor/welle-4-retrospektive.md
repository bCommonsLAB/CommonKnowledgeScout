# Welle-4-Retrospektive (Galerie/Detail/Graph/SDG/Cover)

**Stand:** 2026-06-01
**Branch:** `claude/vibrant-mayer-wR4MG`
**Quellen:** Git-Zeitstempel (`master..branch`) + Session-Transcript (16 MB,
2764 Zeilen, 69 User-Turns). Diese Retro ist datenbasiert rekonstruiert, nicht
aus dem (kompaktierten) Gedächtnis des Agents.

Schwester-Dokumente: [`playbook.md`](./playbook.md) (R1–R3),
[`cover-image-deterministic-flow/`](./cover-image-deterministic-flow/).

---

## 1) Kennzahlen

| Metrik | Wert |
|---|---|
| Echte User-Turns (Text) | **69** |
| Tool-Calls gesamt | **824** |
| Wall-Clock | 31.05. 16:40 → 01.06. 18:04 (~25 h, mit Übernacht-Pause) |
| Erzwungene Kontext-Kompaktierungen | **1** (Turn 63, 17:22) |
| Geschätzter Rework-Anteil | **~36 %** der Turns (Korrekturen, Regressionen, „still broken"-Schleifen, Interrupts) |

**Die Kompaktierung ist der objektive Beleg: die Session war zu lang.** Der
Kontext ist physisch übergelaufen — nicht „gefühlt", sondern hart an der Grenze.

---

## 2) Chronologie (aus den Daten)

| Zeit | Turns | Thema | Churn-Signal |
|---|---|---|---|
| 31.05 16:40–21:49 | 1–11 | Graph Quelle A/B/C, Relations, SDG-Konzept | viel reine Konzept-Klärung (Turns 2–4: 0 Tool-Calls) |
| 01.06 11:04–12:25 | 12–22 | SDG-Rad bauen + Styling | **5 Interrupts/„zu dominant/hässlich"** (17–22) |
| 12:28–15:06 | 23–45 | **Detail-View-Redesign** | **größter Sumpf**: ~15 Mini-Iterationen, Regression (T34), Interrupts (26,39,44) |
| 15:14–16:32 | 46–55 | Prio-Index Naming + Persistenz | „100/100 falsch" → 4× „immer noch nicht sichtbar" |
| 16:34–17:36 | 56–64 | Tabellen-Scroll | **5 Round-Trips** auf dasselbe Problem |
| 17:37–18:04 | 65–69 | Cover-Bild + Deploy + Retro | — |

---

## 3) Lost-in-the-Middle — belegt, nicht behauptet

1. **Recency-Bias des Agents als Live-Beweis.** Die erste Retro nannte nur
   Mapper/Scroll/Cover = Turns **64–67**, also alles **nach** der Kompaktierung.
   Der Mittelteil war nur noch als verlustbehaftete Summary präsent.
2. **Echte Regression im Mittelteil:** Turn 34 *„ki texte sind wieder schwarz,
   sollten blau sein"* — in Turn ~32 bereits gefixt. Mitten in der
   Detail-Iteration ging eine frühere Korrektur verloren.
3. **Der teuerste Bug (Prio-Index, Doppel-Mapper) entstand spät** (Turns
   46→55→59→60→61, „immer noch nicht sichtbar" ×4), als der frühe Datenfluss-
   Kontext bereits verdrängt war.

---

## 4) Die wiederkehrende Bug-Klasse: dupliziertes State ohne Single Writer

Die teuersten Bugs dieser Welle (Prio-Index leer, Cover verloren) sind **derselbe
Bug** in zwei Gewändern: Dieselbe Wahrheit liegt mehrfach
(**Frontmatter ↔ `docMetaJson` ↔ Top-Level-Mongo-Feld**), und jeder Schreibpfad
muss daran denken, *alle* Kopien zu pflegen.

| Symptom | Wurzel (Datei:Zeile) |
|---|---|
| Prio-Index in Tabelle leer | Zwei DocCardMeta-Mapper: `doc-meta-formatter.ts:122` (`convertMongoDocToDocCardMeta`) **und** `gallery/types.ts:235` (`mapItemToDocCardMeta`) — Feld nur in einem ergänzt |
| Cover bei Re-Transform verloren | `vector-repo.ts:661` `$set` ersetzt `docMetaJson` komplett → nicht re-emittierte Felder werden still gelöscht |
| Tote/irreführende Projektion | `vector-repo.ts:1050` projiziert Top-Level `coverImageUrl`, aber `meta-document-builder.ts` schreibt es **nie** |
| Mapper liest nicht-existentes Feld | `doc-meta-formatter.ts:178` `doc.coverImageUrl \|\| docMeta.coverImageUrl` — der erste Operand wird im Hauptpfad nie befüllt |

> **Diese Welle hat Instanzen gefixt, nicht die Klasse.** Beim *nächsten* neuen
> Galerie-Feld tritt derselbe Bug wieder auf. Das war absehbar: die
> [`cover-image-deterministic-flow`-Analyse](./cover-image-deterministic-flow/01-analysis.md)
> vom **30.04.2026** forderte bereits eine „Single Source of Truth für Medien" —
> der Cover-Bug ~1 Monat später zeigt, dass der bekannte Refactor nicht griff.

---

## 5) Code-Hotspots (Refactoring-Kandidaten, nach Schmerz sortiert)

Die AGENTS-Regel „Dateien max. 200 Zeilen" ist **Theater**: 315 Dateien > 200,
23 > 1000. Die in dieser Welle angefassten Brennpunkte:

| Datei | Zeilen | Problem |
|---|---:|---|
| `lib/external-jobs/phase-template.ts` | 2165 | `mergedMeta` als mutierender 500-Zeilen-Sammeltopf (Slug, Prio-Index, Cover reinmutiert) |
| `lib/repositories/vector-repo.ts` | 1940 | `$set`-Full-Replace; tote Cover-Projektion |
| `lib/chat/ingestion-service.ts` | 1516 | Cover-Auflösung = ~300 Zeilen „PRIORITÄT 0/1/2" + zwei „STUFE"-Azure-Pässe (`:327/:423/:488`) |
| `components/library/gallery/gallery-root.tsx` | 1195 | ~6 Ebenen verschachteltes Flex+Grid mit `overflow`/`min-h-0`; vergessener `console.log` (`:134`) |

**Empfohlene Eingriffe:**
1. **Zwei DocCardMeta-Mapper vereinheitlichen** — oder mind. ein **Paritäts-Test**
   (fällt rot bei Feld-Drift). Billigster Hebel, verhindert die ganze Bug-Klasse.
2. **Cover-Auflösung aus `ingestion-service.ts` herauslösen** in ein Modul mit
   explizitem **Erhaltungs-Contract** (analog der bestehenden Analyse).
3. **`$set`-Full-Replace** durch explizite Merge-/Preserve-Semantik ersetzen
   ODER einen dokumentierten „diese Felder bleiben erhalten"-Vertrag.
4. **Tote Top-Level-`coverImageUrl`-Projektion** löschen oder konsistent befüllen.
5. **`console.log` in `gallery-root.tsx:134`** entfernen + Lint-Regel gegen
   `console.log` in `components/`.

---

## 6) Doku-Lücken

- **„Galerie-Datenfluss"-Spec fehlt:** MongoDB-Doc → *welcher* Mapper →
  Karte/Tabelle/Detail. Hätte den Prio-Index-Bug verhindert.
- **„Cover-Bild-Lebenszyklus" fehlt:** Wo generiert, wo gespeichert (Frontmatter
  vs. `docMetaJson` vs. Top-Level), und der **Erhaltungs-Contract bei
  Re-Transform** (in dieser Welle erstmals etabliert: `phase-template.ts`
  Carry-Forward + `ingestion-service.ts` Carry-Forward).
- **`library-config-field.mdc`-Checkliste** führt offenbar **nicht** „beide
  DocCardMeta-Mapper" — sonst wäre der Bug nicht passiert.

---

## 7) Lehren — Regeln fürs nächste Mal

Diese Welle hat das eigene Ritual aus [`playbook.md`](./playbook.md) (R1: „Eine
Welle, ein Test-Cycle, ein Push") und AGENTS.md („Pro Welle EINE PR" +
Hand-off-Block) **verletzt**: Graph-Quellen A/B/C + SDG + Detail-Redesign +
Prio-Index + Relations + Cover landeten in **einer** 69-Turn-Session. Das ist die
strukturelle Ursache der Länge — nicht die einzelnen Bugs.

- **R-W4-1 — Hard-Cut pro Feature/Welle.** Feature fertig → committen,
  Hand-off-Block, **neue Session**. Faustregel: **spätestens bei der ersten
  erzwungenen Kompaktierung ist die Session „voll"** — danach steigt die
  Fehler-/Regressionsrate messbar (siehe §3).
- **R-W4-2 — UI-Polish ≠ Architektur-Arbeit in derselben Session.** Die 15
  Styling-Runden (T23–45) fraßen Kontext, den der Cover-Bug (T65+) später
  brauchte. Pixel-Iterationen in eine eigene, kurze Session.
- **R-W4-3 — Bei „still broken ×3": Modus wechseln.** Nicht weiter raten
  (Scroll = 5 Runden), sondern einmal die ganze Kette sauber analysieren. Für
  Layout fehlt ein **E2E/Visual-Test** — der hätte 4 der 5 Scroll-Runden gespart.
- **R-W4-4 — Neues Galerie-Feld? Zuerst nach ALLEN Mappern/Schreibpfaden
  greppen.** Annahme „es gibt einen Mapper" kostete eine User-Runde inkl. DB-Dump.

---

## 8) Konkrete Follow-up-Tasks

- [ ] Paritäts-Test für `convertMongoDocToDocCardMeta` ↔ `mapItemToDocCardMeta`
- [ ] `docs/architecture/cover-image-lifecycle.md` (inkl. Erhaltungs-Contract)
- [ ] `docs/architecture/gallery-data-flow.md` (Feld-Fluss-Karte)
- [ ] `library-config-field.mdc`: „beide DocCardMeta-Mapper" + „Schreibpfade" ergänzen
- [ ] `console.log` in `gallery-root.tsx:134` entfernen; ESLint `no-console` für `components/`
- [ ] Tote `coverImageUrl`-Top-Level-Projektion in `vector-repo.ts` klären
- [ ] 200-Zeilen-Regel ehrlich machen: „neue Dateien ≤ 200; Bestand beim Anfassen splitten"
