# Cloud-Agent-Brief: DIVA-Texture-Liefersystem-Integration

Stand: 2026-05-26. Erstellt als Setup-Doku fuer die mehrstufige Welle.

## Kontext (lies das ZUERST — verbindlich)

1. **Plan**: [.cursor/plans/diva-texture-liefersystem-integration_e7c2a98f.plan.md](../../../.cursor/plans/diva-texture-liefersystem-integration_e7c2a98f.plan.md) — komplette Welle, alle Stufen, Edge-Cases, Stolperfallen, User-Journey.
2. **Spec — Datenmodell**: [docs/diva-texture-analysen/material-digital-twin.md](../../diva-texture-analysen/material-digital-twin.md) — Material Digital Twin Modell von Lea. WICHTIG: liefert die FELD-HERKUNFT + Enum-Werte (Stufe 2/3/5), ist aber das spaetere verschachtelte MongoDB-Objekt. Das Preprocess-Template ist FLACH (snake_case, Obsidian-kompatibel) — siehe Plan Lea-Regel #8 + Quellen-Map `src/lib/diva-texture/material-field-sources.ts`.
3. **Spec — Besprechung mit Lea**: [docs/diva-texture-analysen/besprechung-lea-materialien.md](../../diva-texture-analysen/besprechung-lea-materialien.md) — Transkript, aus dem die Regeln in Plan-Section 4 extrahiert sind.
4. **Sample-Daten**: [docs/diva-texture-analysen/api2_GetJsonOptionValues_sample.json](../../diva-texture-analysen/api2_GetJsonOptionValues_sample.json) — Beispiel-Sidecar, Basis fuer Loader-Tests in Stufe 1.
5. **Aktuelles Template** (wird in Stufe 2 ersetzt): [template-samples/Diva-Texture-Analysis.md](../../../template-samples/Diva-Texture-Analysis.md).
6. **AGENTS.md** im Repo-Root + alle `.cursor/rules/*.mdc` mit `alwaysApply: true`.
7. **Architektur-Rules** (alle relevant):
   - [storage-abstraction.mdc](../../../.cursor/rules/storage-abstraction.mdc) — UI darf Storage-Backend nicht kennen
   - [no-silent-fallbacks.mdc](../../../.cursor/rules/no-silent-fallbacks.mdc) — keine leeren Catches
   - [media-lifecycle.mdc](../../../.cursor/rules/media-lifecycle.mdc) — Frontmatter enthaelt nur Dateinamen
   - [contracts-story-pipeline.mdc](../../../.cursor/rules/contracts-story-pipeline.mdc) — Pipeline-Aenderungen (Stufe 3 + 5)

## Welle-Struktur

7 Stufen + Stufe 0 (Setup). Cloud-Agents arbeiten **seriell**, nicht parallel
— sonst Konflikte beim Library-Schema und im File-Preview.

| Stufe | Branch | Inhalt | Status |
|---|---|---|---|
| **0** Setup | `feature/diva-texture-welle-setup` | Plan + Quell-Docs + AGENT-BRIEF | DIESE PR |
| **1** Anzeige | `feature/diva-texture-info-tab` | Library-Setting, Sidecar-Loader + Matcher, API-Route, DIVA-Info-Tab mit Bildwahl | Cloud-Lauf NACH Setup-Merge |
| **2** Template | `feature/diva-texture-template-digital-twin` | Template-Refactor auf Material-Digital-Twin-Modell | Cloud-Lauf NACH Stufe 1 (oder parallel — siehe R2) |
| **3** Voll-Pass 1 | `feature/diva-texture-pipeline-first-pass` | Pipeline-Integration mit Sidecar-Kontext, ALLE Material-Felder in einem LLM-Call (User-Entscheid 2026-05-28) | Cloud-Lauf NACH Stufe 1 + 2 |
| **4** Galerie-Verifikation + Propagation | `feature/diva-texture-group-classification` | Galerie-UI zur Verifikation, Korrektur und Stoffgruppen-Propagation. KEIN LLM-Call aus der Galerie (User-Entscheid 2026-05-28) | Cloud-Lauf NACH Stufe 3 |
| **5** Korrektur-Lauf | `feature/diva-texture-pipeline-correction-run` (frueher `-second-pass`) | Optionaler LLM-Lauf nur fuer Materialien mit `needs_visual_refresh=true` (User-Entscheid 2026-05-28) | Cloud-Lauf NACH Stufe 4 |
| **6** Persistenz | `feature/diva-texture-persist-supplier-snapshot` | Sidecar-Snapshot + Lauf-Historie im Frontmatter | Cloud-Lauf parallel zu Stufe 4/5 moeglich |
| **7** Migration | `chore/diva-texture-migration` (optional) | Migration bestehender Analysen | NUR wenn User entscheidet |

**R2 (Serialisierung):** Standardmaessig erst eine Stufe mergen, dann naechste
starten. Begruendung: Stufe 2 aendert die Frontmatter-Felder, die Stufe 1 im
Tab anzeigen koennte. Stufe 3 nutzt das neue Template aus Stufe 2.

Ausnahme: Stufe 6 ist relativ unabhaengig (nur Frontmatter-Schema-Erweiterung
+ Persistenz-Helper) und kann nach Stufe 3 parallel zu Stufe 4 starten,
sofern keine Konflikte in `template-samples/Diva-Texture-Analysis.md`.

## Allgemeine Regeln fuer alle Stufen

- **Sprache**: Code englisch, Kommentare + Commit-Messages auf Deutsch.
- **Dateien max. 200 Zeilen**, sonst aufsplitten.
- **Kein `any`, kein leeres `catch {}`** — beides Lint-Error.
- **Silent Fallbacks verboten**.
- **TypeScript-Strict-Mode** aktiv, `unknown` + Type-Guard statt `any`.
- **Test- und Lint-Commands (Pflicht)**: `pnpm test` + `pnpm lint`. Kein
  `pnpm build` (kostet 3-5 USD pro Lauf).
- **Stop-Bedingungen**: siehe AGENTS.md Section "Stop-Bedingungen".
- **Diff-Limit**: max. 1.000 Zeilen Diff pro Commit (hart), max. 5.000 Zeilen
  Brutto-Diff pro PR (weich).
- **Hand-off-Block** am PR-Ende: Verweis auf die naechste Stufe in dieser
  Welle.

---

## Stufe 1 — Anzeige (DIVA-Info-Tab + Bildwahl)

**Branch:** `feature/diva-texture-info-tab`

**Vorbedingungen:**
- Setup-PR (Stufe 0) ist auf master gemergt.
- Plan + diese AGENT-BRIEF gelesen.

**Aufgabe (deterministisch, kein LLM):**

> **Stand: umgesetzt & gemergt (Stufe 1).** Dieser Brief wurde nach der
> Umsetzung mit der Realität abgeglichen (Spec-Freshness). Korrigierte
> Abweichungen sind unten inline markiert (~~durchgestrichen~~ → korrekt).

1. **Library-Setting**: Feld `analyzeDivaTextureInfo: boolean` (default `false`) in der Library-Settings-Persistenz. Wahrscheinlich [src/components/settings/library/library-form.tsx](../../../src/components/settings/library/library-form.tsx) + zugehoeriges Schema/Type. Neuer UI-Abschnitt "Transformation" mit Toggle.
2. **Sidecar-Loader**: `src/lib/diva-texture/load-supplier-data.ts` — laedt `api2_GetJsonOptionValues.json` aus dem Library-Verzeichnis (gleiche Ebene wie die Textur) ueber `StorageProvider`. Filtert `IsTexture === "True"`. Parsed in TypeScript-Interface `OptionvalueEntry`.
3. **Matcher**: `src/lib/diva-texture/match-texture-code.ts` — heuristisch gegen `VCodex`, `PFTFile`, `TextureName` mit Normalisierung (Bindestrich/Unterstrich-Wechsel, Prefix-Strip `3_`, Suffix-Strip `_basecolor.jpg`). Returns `{ entry: OptionvalueEntry, strategy: string } | null`. **Logging aller Versuche** (auch Misses) fuer User-Verifikation — ~~Pino~~ → **`FileLogger`** (`src/lib/debug/logger.ts`); Repo hat kein Pino als Dependency.
4. **API-Route**: `app/api/diva-texture/supplier-data/route.ts`, `GET /api/diva-texture/supplier-data?libraryId=X&fileId=Y` (~~filePath~~ → **`fileId`**: Storage-Abstraktion ist id-basiert). Clerk-Auth, awaited params (Next.js 13+ Pattern), Response `{ matched: boolean, entry?: OptionvalueEntry, materialId?: string, strategy?: string, attempts: MatchAttempt[] }`. Siehe [api-route-conventions.md](../../architecture/api-route-conventions.md).
5. **DIVA-Info-Tab** (~~in `file-preview.tsx`~~ → **in `image-view.tsx`**):
   - Welle 3-II hat die Tabs aus `file-preview.tsx` in die View-Module verlagert. Der Tab wird im jeweiligen View gerendert (Bilder → [src/components/library/file-preview/views/image-view.tsx](../../../src/components/library/file-preview/views/image-view.tsx)); die `PreviewInfoTab`-Union liegt in `views/view-props.ts`. Architektur: [file-preview-tab-architecture.md](../../architecture/file-preview-tab-architecture.md).
   - Tab sichtbar nur wenn `library.config.analyzeDivaTextureInfo === true` UND API-Response `matched === true`.
   - Tab-Label: "DIVA-Info".
6. **View-Komponente**: `src/components/library/file-preview/views/diva-supplier-data-view.tsx`:
   - Linke Spalte: Basecolor-Bild vom Filesystem (das gerade gewaehlt ist).
   - Rechte Spalte: Preview-Bild vom Liefersystem (`entry.Image`-URL, `<img>` direkt — Edge-Case #1 beachten: Fallback wenn nicht erreichbar).
   - Darunter: Metadaten-Tabelle (Feld → Wert: Name, GroupName, Material, VCodex, PFTFile, RGB als Color-Swatch).
   - Radio-Buttons "Quellbild fuer Analyse: [ basecolor | supplier-preview ]". Default basecolor.
   - Match-Strategie als kleine Info-Badge oben.
7. **Persistenz Bildwahl**: ~~ins Material-Frontmatter~~ → in den **generischen Archiv-Property-Store** (MongoDB, `archive_item_properties__<libraryId>`, Route `/api/library/[libraryId]/archive-item-properties`) — Feld `analysisSourceImage: "basecolor" | "supplier-preview"`. Edge-Case #18: an die stabile Material-ID (`VCodex`) gebunden, nicht an `filePath`. Repo-Muster: [mongodb-repository-pattern.md](../../architecture/mongodb-repository-pattern.md).

**Akzeptanzkriterien:**
- Library-Settings: Toggle setzbar, persistiert.
- Im Archiv: Textur auswaehlen → DIVA-Info-Tab erscheint bei Treffer.
- Beide Bilder sichtbar (oder Fallback wenn Liefersystem-Bild tot).
- Bildwahl-Toggle persistiert.
- Unit-Tests fuer Matcher (alle Strategien + Misses, Sample-JSON als Fixture).
- `pnpm lint` + `pnpm test` gruen.

**Stop-Bedingungen (zusaetzlich zu AGENTS.md):**
- Sidecar-Datei fehlt im Sample-Library — Pre-Flight-Hinweis an User.
- StorageProvider hat keinen Read-Sidecar-Endpoint — Klaerung mit User vor Workaround.
- ~~Welle 3-II-Aenderungen am file-preview.tsx machen Tab-Einbau riskant — Pause + Status-Report.~~ (Stufe 1 erledigt: Tab sitzt in `image-view.tsx`, s. Punkt 5.)

**Hand-off:** Naechste Stufe ist **Stufe 2** (Template-Refactor). Kann nach Stufe-1-Merge parallel starten, sofern keine Datei-Konflikte erwartet.

---

## Stufe 2 — Flaches Preprocess-Template (Stand: umgesetzt)

**Branch:** `feature/diva-texture-template-digital-twin`

> **Stand: neu ausgerichtet 2026-05-27 (User-Entscheid).** Template ist ein
> FLACHES, Obsidian-kompatibles Preprocess-Frontmatter — NICHT das
> verschachtelte Digital-Twin-Modell. Die zuvor eingebaute Nested-/Dot-Notation
> wurde zurueckgenommen.

**Vorbedingungen:**
- Stufe 0 (Setup) ist gemergt.
- `material-digital-twin.md` gelesen (als FELD-/Enum-Quelle, nicht als Frontmatter-Form).
- Plan Lea-Regel #8 + #9 + AGENTS.md "Frontmatter-Format" gelesen.

**Aufgabe (umgesetzt):**

1. **Template** [template-samples/Diva-Texture-Analysis.md](../../../template-samples/Diva-Texture-Analysis.md):
   - FLACHES Frontmatter (snake_case, eine Ebene, KEINE Dot-Notation, KEINE nested Objekte).
   - LLM-Felder Pass 1: `material_class`, `material_type` (leer fuer ceramic/glass/plastic), `confidence_class`, `confidence_type`, `needs_human_review`.
   - LLM-Felder Pass 2: `dominant_color_hex`, `color_family`, `color_description`, `surface_finish`, `surface_relief`, `pattern_scale`, `directionality`, `perceived_softness`, `color_variation`, `confidence_visual`.
   - LLM-Felder (letzter Pass): `ai_prompt_positive`, `ai_prompt_negative`, `ai_realism_notes`.
   - Extraktiv aus Pfad: `iln_nummer`, `textur_code`, `availability_scope`, `retailer_iln`.
   - Pipeline-/System-verwaltet (auskommentiert, NICHT im Schema): `last_pass`, `pass1_status`, `pass2_status`, `analysisSourceImage`, `lieferSystemSnapshot`, `groupClassificationId`, `analysisRuns` + technische Bild-Metadaten.
   - NICHT im Template: `color.rgb`, `materialSpecificProperties` (downstream MongoDB-Objekt).
2. **System-Prompt**: LIEFERSYSTEM-Block dokumentiert, Vorrang-Regel ("nicht ueberschreiben, nur ergaenzen"), Zwei-Pass-Erklaerung, ceramic/glass/plastic ohne material_type, Hinweis "flaches JSON".
3. **Quellen-Map** [src/lib/diva-texture/material-field-sources.ts](../../../src/lib/diva-texture/material-field-sources.ts): Herkunft je Feld (Leas Legende, Lea-Regel #4) + `llmFieldsForPass(1|2)`.
4. **DE→EN Material-Mapping** [src/lib/diva-texture/material-class-mapping.ts](../../../src/lib/diva-texture/material-class-mapping.ts): Pure-Funktion, kein LLM-Call.
5. **Schema-Generator** bleibt FLACH (`generateResponseSchemaFromFields()` unveraendert/zurueckgesetzt) — keine nested-Aufloesung.

**Akzeptanzkriterien:**
- Template flach + Obsidian-kompatibel, Schema-Generator erzeugt flaches Schema (Test `diva-texture-template.test.ts`).
- Quellen-Map deckt alle LLM-Frontmatter-Felder ab (Konsistenz-Test).
- DE→EN-Mapping mit Tests fuer alle Sample-Werte.
- `pnpm lint` + `pnpm test` gruen.

**Stop-Bedingungen:**
- Folge-Stufe verlangt nested Frontmatter → STOP, Trennung gilt (Lea-Regel #8).

**Hand-off:** Naechste Stufe **3** (1. LLM-Pass) — filtert Felder ueber `llmFieldsForPass(1)`.

---

## Stufe 3 — Voller Pass-1-Lauf (alle Material-Felder)

**Branch:** `feature/diva-texture-pipeline-first-pass`

> **Stand 2026-05-28: Modell neu ausgerichtet (User-Entscheid).** Stufe 3
> fragt jetzt ALLE Material-Felder in EINEM LLM-Call ab — Klasse, Typ,
> Konfidenzen, visuelle Properties, Farbe, Hints. Begruendung: das LLM
> konditioniert Visuals intern ohnehin auf seine Klassen-Bestimmung; ein
> gesplitteter Pass spart keine Qualitaet, kostet aber einen Extra-Call
> im Happy Path. Eine Folge dieser Entscheidung: `llmFieldsForPass(1)`
> liefert ab jetzt die Vereinigung der frueheren Pass-1- und Pass-2-LLM-
> Felder; die Pass-2-spezifische Feldliste bleibt nur als Marker dessen,
> was im Korrektur-Lauf (Stufe 5) NEU erzeugt wird, falls der User die
> Klasse korrigiert hat.
>
> Maszgeblich sind weiterhin:
> - [template-samples/Diva-Texture-Analysis.md](../../../template-samples/Diva-Texture-Analysis.md)
> - [src/lib/diva-texture/material-field-sources.ts](../../../src/lib/diva-texture/material-field-sources.ts)

**Vorbedingungen:**
- Stufe 1 + Stufe 2 gemergt.

**Aufgabe (umgesetzt):**

1. **Pipeline-Integration** ([src/app/api/external/jobs/[jobId]/start/route.ts](../../../src/app/api/external/jobs/%5BjobId%5D/start/route.ts), Image-Pfad): Beim Lauf der Diva-Texture-Analyse (erkannt am Template-`detailViewType: divaTexture`):
   - Sidecar-Daten aus Stufe-1-Loader (`load-supplier-data.ts`) holen + matchen (`match-texture-code.ts`).
   - Bildwahl (`analysisSourceImage`) aus dem **Archiv-Property-Store** (gebunden an VCodex) lesen — wenn `supplier-preview`, das Liefersystem-Bild **serverseitig herunterladen** (nicht aus Browser-Cache) und ans LLM senden. Stolperfalle #5 beachten.
   - Sidecar-Daten als zweiten Kontext-Block (`LIEFERSYSTEM`) neben dem bestehenden `CONTEXT`-Block ans LLM senden.
   - DE→EN-Material-Mapping anwenden: `Material: "STOFF"` → ~~`materialClass: "fabric"`~~ → **`material_class: "fabric"`** als deterministischer Pre-Wert ans LLM mitgeben.
2. **Lauf-Konfiguration**: Felder werden NICHT hart dupliziert, sondern ueber `llmFieldsForPass(1)` aus der Quellen-Map gezogen. Ab 2026-05-28: der Pass produziert ALLE Material-Felder — **`material_class`, `material_type`, `confidence_class`, `confidence_type`, `needs_human_review`** PLUS die visuellen Properties **`dominant_color_hex`, `color_family`, `color_description`, `surface_finish`, `surface_relief`, `pattern_scale`, `directionality`, `perceived_softness`, `color_variation`, `confidence_visual`** PLUS die Hints **`ai_prompt_positive`, `ai_prompt_negative`, `ai_realism_notes`** (`ai_last_pass`). Es wird NICHTS mehr explizit leer gehalten.
3. **Konfidenz-Kalibrierung** (Stolperfalle #2):
   - Liefersystem-Treffer fuer Class → ~~`materialClassConfidence: 0.95`~~ → **`confidence_class: 0.95`** deterministisch gesetzt (LLM darf nicht ueberschreiben). Treffer = `mapMaterialClass(entry.Material).isKnown === true`.
   - Reine Bild-Klassifikation ohne Liefersystem-Treffer → LLM-Wert mit Cap bei 0.8.
4. **Availability deterministisch** ([src/lib/diva-texture/availability-from-path.ts](../../../src/lib/diva-texture/availability-from-path.ts)): Pfad parsen → enthaelt `DivaStandardMaterials` → ~~`scope: "basic"`, `retailerILN: null`~~ → **`availability_scope: "basic"`, `retailer_iln: ""`**. Sonst 13-stellige ILN aus dem Pfad → **`retailer_iln: <ILN>`** (`availability_scope` bleibt `"basic"`).
5. **Pipeline-/System-Felder** (NICHT vom LLM, NICHT im Antwortschema): Pipeline setzt nach dem Lauf **`last_pass: 1`** und **`pass1_status`** (`done` | `needs_review`). Die Hints (`ai_prompt_*`, `ai_realism_notes`) beziehen sich immer auf den zuletzt gelaufenen Pass (`last_pass`).
6. **Tests**: Pipeline-Integrationstest mit Mock-LLM, Sample-Sidecar, Sample-Bild — 5 Szenarien (Sidecar-Hit / kein Hit / Sidecar+LLM-Konflikt / unbekanntes Material `isKnown=false` / ceramic ohne Type).

**Umgesetzte Dateien:**
- `src/lib/diva-texture/availability-from-path.ts` — deterministische Pfad-Ableitung.
- `src/lib/diva-texture/liefersystem-context.ts` — LIEFERSYSTEM-Block + DE→EN-Mapping.
- `src/lib/diva-texture/first-pass.ts` — deterministische Pass-1-Nachbearbeitung (Confidence-Kalibrierung, ceramic/glass/plastic ohne Type, Pass-2-Felder leer, `last_pass`/`pass1_status`).
- `src/lib/diva-texture/first-pass-runner.ts` — Orchestrierung (Sidecar → Kontext → injizierter LLM-Call → Nachbearbeitung); `isDivaTextureTemplate()`.
- Integration in `start/route.ts` (Image-Pfad) + Tests unter `tests/unit/diva-texture/`.

**Akzeptanzkriterien:**
- Lauf produziert valides FLACHES JSON mit nur den Pass-1-Feldern (+ Hints).
- Sidecar-Treffer fuehrt zu `confidence_class` ≥ 0.9 (deterministisch 0.95).
- Kein Sidecar-Treffer fuehrt zu `confidence_class` < 0.85 (Cap 0.8).
- `last_pass: 1` + `pass1_status` gesetzt; Lauf idempotent.
- `pnpm lint` + `pnpm test` gruen.

**Stop-Bedingungen:**
- Pipeline-Job-Architektur ist anders als erwartet (siehe `src/lib/pipeline/run-pipeline.ts`) — Klaerung.
- Eine Folge-Stufe/dieser Pass verlangt nested Frontmatter → NICHT bauen (Lea-Regel #8).

**Hand-off:** Naechste Stufe **4** (Gruppen-Klassifikation).

---

## Stufe 4 — Galerie-Verifikation + Stoffgruppen-Propagation

**Branch:** `feature/diva-texture-group-classification`

> **Stand 2026-05-28: Modell neu ausgerichtet (User-Entscheid).** Die
> Galerie macht KEINE LLM-Calls. Sie ist eine reine Verifikations-/
> Korrektur-UI auf den von Stufe 3 erzeugten Daten. Die Stoffgruppen-
> Funktion ist keine LLM-Optimierung mehr (jedes Material laeuft eh
> eigenstaendig in Stufe 3), sondern ein Klick-Aufwand-Reduzierer fuer
> die Klassen-Verifikation.

**Vorbedingungen:**
- Stufe 3 gemergt (jedes Material hat einen vollen Pass-1-Lauf).

**Aufgabe:**

1. **Galerie-Gruppierung**: Texturen nach `group_name` gruppieren (aus
   Sidecar via Stufe 3 ins Frontmatter gepatcht).
2. **DivaTextureCard-Badges**: zeigt material_class / material_type +
   Konfidenz + locked-/rejected-Indikator + `needs_visual_refresh`-Marker.
3. **Per-Material-Aktionen** (Card oder Detail-Tab):
   - Klasse/Typ inline editieren → Frontmatter-Patch ans Artefakt;
     bei geaendeter Klasse: `needs_visual_refresh=true`.
   - `classification_locked` toggeln (Override-Schutz, Edge-Case #6).
   - `classification_rejected` toggeln (Edge-Case #17).
4. **Stoffgruppen-Klassifikations-Dialog**:
   - Liest die bereits vorhandene Pass-1-Klassifikation eines
     Repraesentativen aus MongoDB (Praeferenz: Mitglied mit
     `analysisSourceImage='supplier-preview'`).
   - **KEIN LLM-Call.** Wenn der Repraesentativ noch keinen Pass-1 hat:
     UI-Hinweis "Bitte zuerst Pass-1 im Archiv ausfuehren".
   - Buttons: "Korrigieren" (inline editieren, danach apply) /
     "Verwerfen fuer ganze Gruppe" (`classification_rejected=true`) /
     "Uebernehmen fuer N Mitglieder".
   - Beim Apply pro Mitglied: 5 Klassen-Felder per Frontmatter-Patch
     (material_class, material_type, confidence_class, confidence_type,
     needs_human_review). Wenn die Klasse sich aendert: zusaetzlich
     `needs_visual_refresh=true`.
5. **Bulk-Auto-Apply**: Library-Setting `autoApplyConfidenceThreshold`
   (default 0.9). Globaler Button "Alle Gruppen mit Konfidenz ≥
   Schwellwert uebernehmen".
6. **Override-Schutz**: Mitglieder mit `classification_locked=true` oder
   `classification_rejected=true` werden NICHT ueberschrieben.

**Akzeptanzkriterien:**
- Pro Gruppe: 0 LLM-Calls aus der Galerie. Verifikation: keine
  Secretary-Aufrufe waehrend Bulk-Apply.
- Bulk-Apply propagiert die 5 Klassen-Felder auf alle nicht
  gelockten/nicht verworfenen Mitglieder.
- `needs_visual_refresh` wird konsistent gesetzt, wo Klasse geaendert wurde.
- Korrekturen werden ins Shadow-Twin-Artefakt zurueckgeschrieben
  (Markdown + parsed Frontmatter); auch das ingestete `docMetaJson` ist
  aktuell.
- Galerie zeigt material_class + Typ + Konfidenz pro Material als Badge.
- `pnpm lint` + `pnpm test` gruen.

**Stop-Bedingungen:**
- Galerie-Refactor von Welle 3-III blockiert Group-By-Erweiterung → Status-Report.

**Hand-off:** Naechste Stufe **5** (Korrektur-Lauf).

---

## Stufe 5 — Korrektur-Lauf im Archiv (optional, on demand)

**Branch:** `feature/diva-texture-pipeline-correction-run` (frueher
`feature/diva-texture-pipeline-second-pass`).

> **Stand 2026-05-28: Modell neu ausgerichtet (User-Entscheid).** Kein
> Default-zweiter-Pass mehr. Der Korrektur-Lauf ist ein OPTIONAL
> aufrufbarer Job fuer Materialien, deren material_class/_type
> nachtraeglich vom Klassifizierer korrigiert wurde
> (`needs_visual_refresh=true`).

**Vorbedingungen:**
- Stufe 4 gemergt; mindestens ein Material hat `needs_visual_refresh=true`
  (z.B. durch Klasse-Korrektur in der Galerie oder Gruppen-Propagation
  mit Klassen-Wechsel).

**Aufgabe:**

1. **Korrektur-Trigger**: Im Archiv (Shadow-Twin-View) Button "Korrektur-Lauf
   starten", aktivierbar nur wenn `needs_visual_refresh=true`. Optional:
   Bulk-Action "Alle Materialien mit Refresh-Marker korrigieren".
2. **Pipeline-Job**: laeuft identisch zu Pass 1 (gleiches Template,
   gleicher Image-Analyzer), aber mit zusaetzlichem CONTEXT-Block:
   - `user_confirmed_material_class: <wert>`
   - `user_confirmed_material_type: <wert>`
   - System-Prompt-Hinweis: "Klasse + Typ sind bereits vom Klassifizierer
     bestaetigt — bitte die visuellen Properties und Hints konsistent
     dazu neu bestimmen, ohne die Klasse zu hinterfragen."
3. **Nachbearbeitung**:
   - LLM-Ergebnis: visuelle Properties (color, surface_*, pattern_scale,
     directionality, perceived_softness, color_variation, confidence_visual)
     + Hints (ai_prompt_*, ai_realism_notes) werden uebernommen.
   - material_class / material_type / confidence_class / confidence_type
     / needs_human_review bleiben durch die User-Bestaetigung fixiert.
   - Pipeline setzt `last_pass: 2` + `pass2_status: done|needs_review`.
   - Pipeline raeumt `needs_visual_refresh` ab.
4. **Liefersystem-Kontext bleibt mit** (z.B. "Eiche geoelt" aus
   Stammdaten → `surface_finish: oiled`).
5. **Pipeline-Re-Use**: Stufe-3-Mechanik wiederverwenden, gleiche
   Felder, anderer CONTEXT-Block.

**Akzeptanzkriterien:**
- Korrektur-Lauf produziert visuelle Properties konsistent zur
  user-bestaetigten Klasse.
- material_class / material_type / confidence_class / confidence_type
  bleiben unveraendert.
- `needs_visual_refresh` ist nach erfolgreichem Lauf `false`.
- `last_pass: 2` und `pass2_status` sind gesetzt.
- Lauf ist idempotent.
- `pnpm lint` + `pnpm test` gruen.

**Stop-Bedingungen:**
- Wenn die Bilder generell zu schlecht sind: Status-Report, ggf.
  Bildwahl-Korrektur in Stufe 1.

**Hand-off:** Naechste Stufe **6** (Persistenz) — falls nicht schon parallel laufend.

---

## Stufe 6 — Persistenz Liefersystem-Snapshot + Lauf-Historie

**Branch:** `feature/diva-texture-persist-supplier-snapshot`

**Vorbedingungen:**
- Stufe 3 gemergt (mindestens), Stufe 4/5 koennen parallel laufen.

**Aufgabe:**

1. **Snapshot beim 1. Lauf schreiben**: In Material-Frontmatter neues Feld `lieferSystemSnapshot`:
   ```yaml
   lieferSystemSnapshot:
     fetchedAt: 2026-05-26T14:23:00Z
     sourceFile: api2_GetJsonOptionValues.json
     sourceFileHash: sha256:...
     entry:
       VCodex: ...
       Name: ...
       # 1:1-Kopie des Sidecar-Eintrags
   ```
2. **Lauf-Historie**: Feld `analysisRuns: Array`:
   ```yaml
   analysisRuns:
     - timestamp: 2026-05-26T14:23:00Z
       passNumber: 1
       sourceImage: basecolor
       confidence: 0.92
       fieldsEvaluated: [materialClass, materialType, aiGenerationHints]
       classifier: group
       groupClassificationId: gc-feincord-2026-05-26
   ```
3. **Folgelaeufe nutzen Snapshot**: 2. Pass (Stufe 5) liest `lieferSystemSnapshot.entry` statt erneuten Sidecar-Lookup.
4. **Stale-Detection** (Edge-Case #9): Wenn Sidecar-File-Hash heute anders als im Snapshot → UI-Hinweis "Stammdaten geaendert seit Klassifikation".

**Akzeptanzkriterien:**
- Snapshot wird beim 1. Lauf geschrieben.
- 2. Lauf nutzt Snapshot ohne neuen API-Call.
- Re-Analyse ist idempotent (gleiche Inputs → gleicher Snapshot, neuer Lauf-Eintrag).
- Stale-Detection funktioniert (manueller Test: Sidecar editieren, Hinweis erscheint).

**Stop-Bedingungen:**
- Frontmatter wird zu gross (>50 Eintraege in `analysisRuns`) — Klaerung ob Truncation oder eigenes Sub-Dokument.

**Hand-off:** Naechste Stufe **7** (optional).

---

## Stufe 7 — Migration alter Analysen (OPTIONAL)

**Branch:** `chore/diva-texture-migration`

**Vorbedingungen:**
- User-Entscheidung vorher einholen ob noetig.

**Aufgabe:**

1. Script `scripts/migrate-diva-texture-analyses.mjs` das bestehende Materialien mit altem Schema findet und migriert oder deprecated markiert.

**Akzeptanzkriterien:**
- Entscheidung explizit dokumentiert in PR-Body.

---

## Wiederkehrende Pflicht-Schritte am PR-Ende

Pro Stufe-PR:

1. `pnpm lint` lokal/CI gruen.
2. `pnpm test` gruen.
3. PR-Body enthaelt **Hand-off-Block** mit:
   - Verweis auf naechste Stufe in dieser Welle.
   - Modellempfehlung (Sonnet/Opus + Thinking-Level).
   - Konkreter Start-Prompt fuer naechste Cloud-Session.
   - Kosten-Schaetzung.
4. PR-Body enthaelt **Sidecar-Match-Log-Snippet** (Stufe 1-Output) falls relevant.

## Start-Prompts (kopierbar in Cloud-Agent)

Siehe separate Sektion am Ende dieser Datei nach Setup-Merge.
