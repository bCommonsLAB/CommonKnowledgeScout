# Phase 1 — Use-Case-Inventur: Wizards & Templates über alle Libraries

> Stand: 2026-05-31. Erste echte Arbeit der Wizard-Neuordnung (vgl.
> `00-refactor-plan.md`, Phase 1). Datenbasis: alle 26 Vorlagen unter
> `template-samples/`, abgeglichen gegen die Renderer-Registry im Code.
>
> Zweck: festhalten, **welche Wizards/Use-Cases real existieren**, was sie
> gemeinsam haben, und wo die historisch gewachsene Drift sitzt — als
> Grundlage für die Trennung Wizard ↔ Schema (künftiges ADR-0003) und für
> die konsolidierte Test-Library (Phase 2).

## 1. Methode

Pro Vorlage extrahiert: Typ (hat `creation:`-Block = **Wizard**, sonst
**Schema-only**), `detailViewType`, Anzahl Schema-Felder (`{{feld|…}}`),
Anzahl Wizard-Steps, Quelltypen, eingebettete Lauf-Daten ("Leak").

**Drift-Baseline** (aus dem Code):
- Kanonische Union `TemplatePreviewDetailViewType`
  (`src/lib/templates/detail-view-type-utils.ts`): **8** Typen —
  `book, session, testimonial, blog, climateAction, divaDocument,
  divaTexture, refurbedDevice`.
- Der **Wizard-Preview** (`resolveTemplateDetailViewType()` in
  `creation-wizard.tsx`) kennt nur **4** — `book, session, testimonial,
  blog` — und fällt sonst still auf `'session'` zurück.
- `divaProductProfile` (in `gaderform-bett-steckbrief-de`) ist in **keiner**
  Registry → echter Waise.

## 2. Kennzahlen (die Kernbotschaft)

| Metrik | Wert | Bedeutung |
|---|---:|---|
| Vorlagen gesamt | 26 | — |
| davon **Wizard** (mit Flow) | **9** | UI + Schema + Extractor verschmolzen |
| davon **Schema-only** (ohne Flow) | **17** | Datenmodell + Extractor, **schon getrennt** |
| Vorlagen mit `systemprompt` (Extractor) | **26 / 26** | Extractor ist *universeller* Belang |
| Vorlagen mit Lauf-Daten-Leak | **6** | konkrete Inhalte in der Vorlage betoniert |
| distinkte Wizard-Presets | **9** | kleines, geteiltes Flow-Vokabular |
| distinkte Quelltypen | **5** | `text, url, folder, file, spoken` |
| detailViewType: `ok` / `Wizard-Preview fehlt` / `—` / `ORPHAN` | 13 / **7** / 5 / **1** | Renderer-Drift |

> **Wichtigster Befund**: Die Trennung Wizard ↔ Schema ist **keine Hypothese**.
> **17 von 26** Vorlagen leben bereits als reines Schema (+Extractor) ohne
> jede UI — sie werden vom **JobWorker/Pipeline** konsumiert, nicht vom
> Wizard. Die Verschmelzung existiert nur in den **9** Wizard-Vorlagen.
> Wir formalisieren also eine Trennung, die zu zwei Dritteln schon Realität ist.

## 3. Vollständige Inventur

| Familie | Template | Typ | detailViewType | Drift | Felder | Steps | Quellen | Leak |
|---|---|---|---|---|---:|---:|---|:--:|
| Dialograum | dialograum-creation-de-test.md | Wizard | session | ok | 6 | 4 | text+url |  |
| Dialograum | dialograum-creation-de.md | Wizard | session | ok | 6 | 3 | text |  |
| Dialograum | dialograum-ergebnis-de.md | Wizard | session | ok | 9 | 6 | file+text |  |
| Event | cast-event-creation-de.md | Wizard | session | ok | 22 | 7 | folder+text+url | ⚠️ |
| Event | event-creation-de.md | Wizard | session | ok | 22 | 7 | folder+text+url | ⚠️ |
| Event | event-finalize-de.md | Wizard | session | ok | 11 | 6 | file |  |
| Event | event-testimonial-creation-de.md | Wizard | testimonial | ok | 6 | 5 | spoken+text |  |
| Event | off-aktionsbericht-de.md | Wizard | session | ok | 20 | 8 | folder+text+url |  |
| Testimonial | testimonial-creation-de.md | Wizard | testimonial | ok | 11 | 4 | text |  |
| Diva/Katalog | ada_…Pricesheet-to-Diva-Import.md | Schema | divaDocument | Wiz-Preview fehlt | 10 | 0 | — |  |
| Diva/Katalog | ada_…-to-Diva-Preisliste.md | Schema | divaDocument | Wiz-Preview fehlt | 10 | 0 | — |  |
| Diva/Katalog | diva-methode-einfach.md | Schema | — | — | 9 | 0 | — |  |
| Diva/Katalog | divaKatalog-detail-de.md | Schema | divaDocument | Wiz-Preview fehlt | 23 | 0 | — |  |
| Diva/Katalog | gaderform-holzarten-de.md | Schema | divaDocument | Wiz-Preview fehlt | 11 | 0 | — |  |
| PDF/Analyse | extract_method_from_PDF_en.md | Schema | — | — | 22 | 0 | — |  |
| PDF/Analyse | meeting_analyse-de.md | Schema | book | ok | 17 | 0 | — |  |
| PDF/Analyse | pdfanalyse-commoning.md | Schema | book | ok | 25 | 0 | — | ⚠️ |
| PDF/Analyse | pdfanalyse-ecosocial.md | Schema | book | ok | 26 | 0 | — | ⚠️ |
| PDF/Analyse | pdfanalyse-klima.md | Schema | book | ok | 27 | 0 | — | ⚠️ |
| PDF/Analyse | pdfanalyse.md | Schema | — | — | 25 | 0 | — | ⚠️ |
| Sonstige | Diva-Texture-Analysis.md | Schema | divaTexture | Wiz-Preview fehlt | 26 | 0 | — |  |
| Sonstige | Session_de.md | Schema | — | — | 11 | 0 | — |  |
| Sonstige | article-breafing.md | Schema | — | — | 7 | 0 | — |  |
| Steckbrief/Profil | gaderform-bett-steckbrief-de.md | Schema | divaProductProfile | **ORPHAN** | 24 | 0 | — |  |
| Steckbrief/Profil | klimamassnahme-detail1-de.md | Schema | climateAction | Wiz-Preview fehlt | 29 | 0 | — |  |
| Steckbrief/Profil | pc-steckbrief-de.md | Schema | refurbedDevice | Wiz-Preview fehlt | 15 | 0 | — |  |

## 4. Use-Case-Familien

| Familie | Wizards | Schemas | Charakter | Konsument |
|---|---:|---:|---|---|
| **Event** | 5 | 0 | Story aus Text/URL/Ordner; Container für Testimonials | Wizard |
| **Dialograum** | 3 | 0 | Dialog erfassen + Ergebnis aus Testimonials | Wizard |
| **Testimonial** | 1 | 0 | kurze Einzel-Aussage, auch diktiert (`spoken`) | Wizard |
| **PDF/Analyse** | 0 | 6 | PDF → strukturiertes „Buch"-Dokument | **JobWorker** |
| **Diva/Katalog** | 0 | 5 | Produkt-/Katalogdaten, Preislisten | **JobWorker** |
| **Steckbrief/Profil** | 0 | 3 | Geräte-/Maßnahmen-/Produkt-Profile | **JobWorker** |
| **Sonstige** | 0 | 3 | Texture-Analyse, Briefing, Session | gemischt |

→ Die **Wizard-Familien** (Event/Dialograum/Testimonial) sind alle
„Story/Session"-artig (`detailViewType: session`/`testimonial`). Die
**Schema-Familien** bedienen die Pipeline. Das ist die natürliche Naht:
**Schema + Extractor werden von beiden Konsumenten gebraucht, der Flow nur
vom Wizard.**

## 5. Das generische Flow-Vokabular (schon vorhanden)

**9 Presets** decken alle 9 Wizards ab:

| Preset | Vorkommen | Rolle |
|---|---:|---|
| `editDraft` | 10 | Felder bearbeiten (Kern jedes Wizards) |
| `welcome` | 9 | Einstieg/Erklärung |
| `previewDetail` | 9 | Detail-Vorschau (← Renderer-Drift!) |
| `collectSource` | 6 | Quelle erfassen |
| `generateDraft` | 6 | KI-Extraktion (← Extractor) |
| `publish` | 4 | Speichern/Indexieren |
| `selectFolderArtifacts` | 3 | Ordner-Artefakte wählen |
| `selectRelatedTestimonials` | 2 | verknüpfte Testimonials |
| `uploadImages` | 1 | Bilder hochladen |

**5 Quelltypen**: `text, url, folder, file, spoken`.

→ Das Vokabular ist klein und geteilt. Ein **generischer Wizard** (Collect →
Generate → Edit → Preview → Publish) deckt die Mehrheit ab; Spezialschritte
(`selectFolderArtifacts`, `selectRelatedTestimonials`) sind optionale
Bausteine. Genau das, was eine datengetriebene Engine + Community-Wizards
ermöglichen.

## 6. Drift & Altlasten (konkret)

### 6.1 Renderer-Drift (`previewDetail` vs. Galerie)
7 Vorlagen nutzen `detailViewType`, den der **Wizard-Preview nicht kennt**
(`divaDocument`×4, `divaTexture`, `climateAction`, `refurbedDevice`) — sie
rendern in der Galerie, aber der Wizard-Schritt `previewDetail` fällt still
auf `session` zurück. **1 Waise** (`divaProductProfile`) hat **gar keinen**
Renderer. → Eine **gemeinsame Renderer-Registry** (Galerie + Wizard) ist nötig.

### 6.2 Lauf-Daten-Leck (6 Vorlagen)
`cast-event`/`event-creation` betonieren eine **21-Video-JSON-Liste** eines
konkreten Events in den `systemprompt`. Die vier `pdfanalyse-*` sind faktisch
**dieselbe Analyse mit unterschiedlichem Domänen-Inhalt** (commoning/ecosocial/
klima) — klassische „pro Use-Case kopiert"-Duplikation. → Lauf-/Domänen-Daten
gehören als **Eingabe** an die Ausführung, nicht in die Vorlage.

### 6.3 Flat-Frontmatter-Regel verletzt
Der `creation:`-Block ist ein **verschachteltes** YAML-Objekt im Frontmatter —
gegen die Regel in `AGENTS.md` ("Frontmatter ist FLACH"). Die Trennung des
Flows aus der Vorlage stellt die Compliance wieder her.

## 7. Konsequenzen für die Trennung Wizard ↔ Schema

1. **Schema = Datenmodell + Renderer (`detailViewType`) + Extractor
   (`systemprompt`/responseSchema)** — pro `docType`, von Wizard **und**
   JobWorker konsumiert. 17/26 leben schon so.
2. **Wizard = Flow (Steps/Presets) + Quelltypen + Feld-*Bindung*** — generisch,
   Community-fähig. Bindet an ein Schema (Bindungsmodell **offen**, im ADR zu
   entscheiden — siehe `00-refactor-plan.md`/Gespräch).
3. **Lauf-Daten** (Video-Liste etc.) sind eine **dritte** Kategorie: Eingabe
   einer Ausführung, gehören in keine der beiden Vorlagen.
4. **Eine Renderer-Registry** ersetzt die 4-vs-8-Drift und den Silent-Fallback.

## 8. Kandidaten für die Test-Library (Phase 2)

Minimaler „Kitchen-Sink", der jede Mechanik einmal abdeckt:

| Use-Case | deckt ab |
|---|---|
| Event-Creation (Ordner) | `collectSource`+`selectFolderArtifacts`+`generateDraft`+`publish`, Leak-Migration |
| Testimonial (diktiert) | Quelle `spoken`, kurzes Schema |
| Dialograum-Ergebnis | `selectRelatedTestimonials`, Multi-Schema-Komposition |
| Event-Finalize | Index-Swap/Persistenz-Sonderweg |
| PDF-Analyse | Schema-only via JobWorker + `book`-Renderer |
| Diva-Texture **oder** Steckbrief | Renderer-Drift (`divaTexture`/`refurbedDevice`) |

Damit lassen sich alle 9 Presets, alle 5 Quelltypen, beide Konsumenten
(Wizard + JobWorker) und die Renderer-Drift in **einer** Library testen.

## 9. Nächste Schritte

1. **ADR-0003** „Wizard / Schema-Template trennen" — Modell + Bindungs-Optionen
   (offen) + Konsequenzen festschreiben.
2. **Phase 2**: Test-Library aus den Kandidaten (§8) aufbauen.
3. Erst danach **Phase 3** (generische Merge-Runtime) gemäß `00-refactor-plan.md`.
