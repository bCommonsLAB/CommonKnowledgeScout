# Acceptance: Welle 1 — Bewertungsmodell (Baustein A)

> Stand: 2026-05-30 · Branch: `claude/modest-noether-m6DVR`
> Plan: [`.cursor/plans/massnahmen-bewertung-und-graph_b4e9f1a7.plan.md`](../../.cursor/plans/massnahmen-bewertung-und-graph_b4e9f1a7.plan.md)
> Zielbild §4: [`massnahmen-bewertung-und-graph-zielbild.md`](./massnahmen-bewertung-und-graph-zielbild.md)

## Was wurde umgesetzt

Jede Klimamaßnahme bekommt über das Template LLM-Bewertungsfelder **mit
Begründung** (Südtirol-Bezug); die Galerie kann nach **Rating** sortieren und
Detail/Karte zeigen die Werte **read-only**.

### 1. Template (`template-samples/klimamassnahme-detail1-de.md`)

Neue flache, Obsidian-kompatible Frontmatter-Felder (snake_case, eine Ebene):

- `co2_einsparung_kt` (+ `_begruendung`)
- `durchsetzbarkeit` 0..1 (+ `_begruendung`)
- `kosten_eur` (+ `_begruendung`)
- `score_wirkung` / `score_soziales` / `score_struktur` / `score_bewusstsein`
  (0..1) + gemeinsame `perspektiven_begruendung`
- `dominant_perspektive` (Argmax), `bewertung_modell`, `bewertung_stand`

`systemprompt` + `Antwortschema` entsprechend erweitert. Fehlt die Datenbasis
für eine Zahl → `null` (kein Raten), die Begründung erklärt warum.

### 2. Rating-Util (`src/lib/gallery/rating.ts` + Vitest)

- `computeRatingRaw` = `impact * feasibility / cost`.
- **Kein Silent Fallback:** fehlende oder `cost <= 0` → `status: 'unknown-cost'`
  (kein Epsilon-Trick). Impact/Feasibility fehlend → `'insufficient'`.
- `assignRatingPercentiles` normalisiert gültige Roh-Werte auf **0..100**;
  „Kosten unbekannt" fließt **nicht** in die Verteilung ein.
- 16 Test-Fälle.

### 3. Backend (`vector-repo.ts`, `doc-meta-formatter.ts`, `docs/route.ts`)

- `findDocs` / `findDocsGrouped`: `$addFields`-Stage berechnet `rating`
  (= co2·durchsetzbarkeit/kosten) **vor** `$sort`; `kosten <= 0`/nicht-numerisch
  → `rating: null` (sortiert ans Ende). Spiegelt die Util-Logik.
- `buildGallerySort`: neue **öffentliche** Option `sort=rating`
  (→ `{ rating:-1, year:-1, upsertedAt:-1 }`). `sort=stars` bleibt member-only.
- Galerie-Projektion + Converter + `mapItemToDocCardMeta` um die
  Bewertungsfelder (Zahlen + Begründungen) ergänzt.

### 4. Anzeige (read-only)

- `climate-action-rating.tsx`: Kennzahlen + 4 Perspektiven-Scores mit
  Begründung; „Kosten unbekannt" explizit; KI-Schätzung gekennzeichnet
  (`bewertung_modell`/`-stand`). Reiner Renderer (Contract §1).
- `climate-action-detail.tsx` + `doc-meta-mappers.ts`: Felder durchgereicht.
- `climate-action-card.tsx`: Rating-Perzentil-Badge.
- `filter-context-bar.tsx`: öffentlicher „Nach Rating sortieren"-Toggle.
- `use-gallery-data.ts`: `sortByRating` + client-seitige Perzentil-Anreicherung
  (`ratingPercentile`) über die geladene Menge.
- i18n `gallery.sortByRating` + `climateRating.*` in de/en/it/fr/es.

## Bilanz

- **Brutto-Diff:** 777 Zeilen (4 Commits, je < 1.000z) · 19 Dateien.
- **Tests:** `pnpm test` → 1624 passed. `pnpm lint` → keine Errors.
  `tsc` auf `src/` → 0 Fehler (vorbestehende Test-Datei-Typefehler unberührt).

## Bekannte Grenzen (bewusst, Welle 1)

- **Perzentil ist client-seitig** über die *geladene* Galerie-Menge, nicht
  library-weit. Für library-weite Perzentile braucht es eine Server-
  Aggregation (spätere Politur, Zielbild §4.3 offen).
- **Numerische Range-Facetten** für die Bewertungsfelder wurden **nicht**
  zwingend ergänzt — `dynamic-facets` unterstützt `number`/`integer-range`
  bereits generisch und Facetten sind **per-Library konfigurierbar**
  (`config.chat.gallery.facets`). Eine konkrete Facetten-Belegung ist
  Konfiguration der Library, kein Code-Change dieser Welle.
