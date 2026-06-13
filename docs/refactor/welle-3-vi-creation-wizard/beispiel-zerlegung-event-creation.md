# Beispiel-Zerlegung: `event-creation-de` → Schema | Wizard | Run-Input

> Stand: 2026-05-31. Erste Umsetzungs-Arbeit (P1-Abschluss). Validiert
> ADR-0003 (Wizard/Schema-Trennung) am schwierigsten realen Template und
> liefert die **Migrations-Schablone** für die übrigen ~30 Vorlagen.
>
> **Format-Hinweis**: Die unten gezeigten Datei-Formate sind ein *Vorschlag*.
> Das endgültige On-Disk-/DB-Format und das Feld-Bindungsmodell (ADR-0003, O1)
> werden erst nach der Test-Library (Phase 2) festgelegt. Diese Zerlegung zeigt
> **was wohin gehört**, nicht das finale Serialisierungsformat.

## 0. Ausgangslage

`template-samples/event-creation-de.md` bündelt **fünf** Belange in einer Datei:

| # | Belang | Wo heute |
|---|---|---|
| 1 | Datenmodell (24 Felder) | Frontmatter `key: {{key\|desc}}` |
| 2 | Renderer | `detailViewType: session` |
| 3 | Extractor | `--- systemprompt …` + Body-Render-Hint |
| 4 | Wizard-Flow | `creation:`-Block (7 Steps, 3 Quellen) |
| 5 | **Lauf-Daten** | 21-Video-JSON-Liste **im systemprompt** |

Ziel: 1+2+3 → **Schema** (`event`), 4 → **Wizard**, 5 → **Run-Input**.

---

## 1. Entität A — Schema `event` (Datenmodell + Renderer + Extractor)

> Konsumiert von **Wizard *und* JobWorker**. Entspricht im Kern der heute schon
> existierenden schema-only-Projektion (`serializeTemplateWithoutCreation`).

**A.1 Felder** (flaches snake_case-Frontmatter, AGENTS-konform):

| Feld | Beschreibung | Kategorie |
|---|---|---|
| `docType` | `event` | **System** (auto) |
| `slug` | aus Dateiname | **System** (auto) |
| `testimonialWriteKey` | für QR-Upload | **System** (auto, → ADR-0004) |
| `title`, `shortTitle`, `teaser`, `summary` | Texte | User/Extractor |
| `date`, `location`, `year` | Zeit/Ort | User/Extractor |
| `speakers`, `speakers_image_url`, `speakers_url` | Personen | Extractor |
| `organisation`, `event`, `track` | Einordnung | Extractor |
| `video_url`, `coverImageUrl`, `attachments_url`, `url` | Medien/Links | Extractor |
| `tags`, `topics` | Klassifikation | Extractor |

→ **3 System-Felder** (auto-gesetzt, nicht im Wizard editierbar) klar von den
**~17 Inhalts-Feldern** getrennt. (Heute vermischt — eine Quelle der Verwirrung.)

**A.2 Renderer**: `detailViewType: session` (muss in `VIEW_TYPE_REGISTRY`
existieren — tut es).

**A.3 Extractor**: der `systemprompt` (Journalist-Rolle) **ohne** die
Video-Liste + der Body-Render-Hint für `summary`. Response-Schema = die
Inhalts-Felder aus A.1.

**Vorschlag-Format** (`schemas/event.schema.md`):
```markdown
---
docType: event
detailViewType: session
# Inhalts-Felder
title: {{title|Titel des Events/Talks}}
shortTitle: {{shortTitle|Kurztitel für Listen (max. 50 Zeichen)}}
teaser: {{teaser|Kurzer Teaser-Text}}
summary: {{summary|Ausführliche Zusammenfassung (Markdown)}}
# … übrige Inhalts-Felder …
# System-Felder (auto, nicht editierbar)
slug: {{slug|auto}}
testimonialWriteKey: {{testimonialWriteKey|auto, für QR-Upload}}
relatedSchemas:           # Multi-Schema-Bezug (s. §4)
  - testimonial
---

## Zusammenfassung & Highlights
{{summary|Bitte die Texte … sinnvoll auswerten … (Render-Hint)}}

--- systemprompt
Du bist ein spezialisierter Journalist … (OHNE Video-Liste)
```

---

## 2. Entität B — Wizard (Flow/UI, generisch)

> Wizard-only. Reine Mechanik. Bindet an ein Schema.

Inhalt = der heutige `creation:`-Block (Sources + Flow + Output + UI). **Der
einzige knifflige Punkt ist die Feld-Bindung im `editDraft`-Step.** Zwei
Varianten — die Entscheidung (O1) fällt nach der Test-Library:

**Variante (a) — generisch (Wizard domänenfrei, Community-fähig):**
```yaml
supportedSources: [text, url, folder]
flow:
  - preset: welcome
  - preset: collectSource
  - preset: selectFolderArtifacts
  - preset: generateDraft
  - preset: editDraft
    fields: "$all"        # alle editierbaren Schema-Felder (System-Felder ausgenommen)
  - preset: previewDetail
  - preset: publish
output: { fileName: { fromField: title }, createInOwnFolder: false }
ui: { displayName: "Story aus Ordner", icon: Calendar }
```
→ Dieser Wizard ist **nicht** event-spezifisch — er läuft gegen *jedes* Schema
(„collect → generate → edit → preview → publish"). Genau ein Community-Wizard.

**Variante (b) — rollen-/gruppenbasiert (mehr Kontrolle):**
```yaml
  - preset: editDraft
    fieldGroups: [core, people, media, classification]  # Gruppen im Schema definiert
```

**Naive Migration (Zwischenschritt)**: die heutige explizite `fields`-Liste
1:1 übernehmen — funktioniert, aber macht den Wizard event-spezifisch. Nur als
Übergang, klar markiert.

---

## 3. Entität C — Run-Input (Lauf-Daten, KEIN Template)

Die **21-Video-JSON-Liste** + die feste CAST-URL
(`https://climateaction.bz/neuigkeiten/`) aus dem systemprompt sind **Daten
einer konkreten Ausführung** (Event „Neustift 2026"), nicht der Vorlage.

→ Werden zu **Eingabe einer Submission** (ADR-0004): als referenzierter
Datensatz / Quelle, den der Erfasser (oder ein Owner) der konkreten Erfassung
beigibt. Die Vorlage `event` bleibt sauber und wiederverwendbar.

```
Submission(event) {
  wizardId: "story-aus-ordner"
  schemaId: "event"
  runInput: { sourceCatalog: <21-Video-JSON>, referenceUrl: "https://…" }
}
```

---

## 4. Bindungs- & Bezugspunkte (für die Kompatibilitätsprüfung)

- **editDraft ⟷ Schema**: alle in `fields`/`$all` referenzierten Felder müssen
  im Schema `event` existieren. (Heute: 17 explizite Felder — alle vorhanden ✓.)
- **previewDetail ⟷ Renderer**: `detailViewType: session` muss in
  `VIEW_TYPE_REGISTRY` sein ✓.
- **selectFolderArtifacts ⟷ Sources**: Step verlangt Quelle `folder` ✓.
- **Multi-Schema**: `event` ist „Container für Testimonials" → `relatedSchemas:
  [testimonial]`. Der Finalize-Wizard (`event-finalize`) mergt später Event +
  Testimonials → Primär-Schema `event` + referenziertes `testimonial`.
- **System-Felder** (`docType`, `slug`, `testimonialWriteKey`) sind **nie**
  Wizard-Bindungsziele (auto-gesetzt).

Diese Prüfungen ersetzen die heutigen Silent-Fallbacks durch frühe, klare
Fehler („Wizard X passt nicht zu Schema Y: Feld Z fehlt").

---

## 5. Migrations-Schablone (für die übrigen ~30 Vorlagen)

Pro `template-samples/*.md`:

1. **docType bestimmen** → Schema-Name.
2. **Schema bauen**: alle `key: {{…}}`-Frontmatter-Felder + `detailViewType` +
   `systemprompt` + Body-Render-Hints → `schemas/<docType>.schema.md`.
   System-Felder (`docType`, `slug`, `*WriteKey`, auto-gesetzte) **markieren**.
3. **Run-Daten herauslösen**: eingebettete JSON-Listen / feste URLs aus dem
   systemprompt → Run-Input (Submission-Eingabe). systemprompt wird generisch.
4. **Wizard bauen** (nur bei Vorlagen mit `creation:`-Block, 9 Stück): Sources +
   Flow + Output + UI → `wizards/<name>.wizard.*`.
5. **Feld-Bindung**: `editDraft.fields` zunächst explizit übernehmen (Zwischen-
   schritt) **oder** auf `$all`/Gruppen umstellen — je nach O1-Entscheidung.
6. **Validieren**: alle gebundenen Felder existieren im Schema;
   `detailViewType ∈ VIEW_TYPE_REGISTRY`; benötigte Quellen vorhanden.
7. **Multi-Schema-Bezüge** notieren (`relatedSchemas`).

**Schnell-Bilanz aus der Inventur** (`phase-1-use-case-inventur.md`):
- **17/26** brauchen nur Schritt 1–3 (schema-only, kein Wizard).
- **9/26** brauchen zusätzlich Schritt 4–6 (haben einen Flow).
- **6/26** haben Run-Daten-Lecks (Schritt 3 zwingend): `event-creation`,
  `cast-event-creation`, `pdfanalyse{,-commoning,-ecosocial,-klima}`.
- **1** Renderer-Waise: `divaProductProfile` (`gaderform-bett-steckbrief`) —
  braucht einen Renderer in `VIEW_TYPE_REGISTRY` **oder** Mapping auf einen
  bestehenden Typ.

---

## 6. Erkenntnisse für die nächsten Phasen

- **Schema-Entität ≈ vorhandene schema-only-Projektion** → die Migration kann
  `serializeTemplateWithoutCreation` als Startpunkt nutzen (geringer Aufwand).
- **System- vs. Inhalts-Felder trennen** ist ein eigener, lohnender Cleanup
  (heute vermischt) — gehört ins Schema-Modell.
- **Ein einziger generischer „Story aus Ordner"-Wizard** deckt event-creation,
  cast-event, off-aktionsbericht ab (gleicher Flow) → bestätigt die
  Community-Wizard-These und reduziert die 9 Wizards auf wenige generische.
- **O1 (Feld-Bindung)** lässt sich an dieser Familie gut entscheiden: Variante
  (a) `$all` würde hier funktionieren; Feinkontrolle (b) erst prüfen, wenn ein
  Use-Case sie wirklich braucht.

## 7. Nächster Schritt
Phase 2 — **Test-Library** aus den Kandidaten (Inventur §8) aufbauen und 1–2
weitere Vorlagen nach dieser Schablone zerlegen (eine schema-only, z.B.
`pdfanalyse-commoning`, + die Multi-Schema-Familie `event-finalize`), um das
Modell und die O1-Entscheidung abzusichern.
