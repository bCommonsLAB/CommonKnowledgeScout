# Test-Library „Kitchen-Sink"

> Stand: 2026-06-02. Physischer Prüfstand für das Wizard/Schema-Modell aus
> [`docs/adr/0003-wizard-schema-template-trennen.md`](../docs/adr/0003-wizard-schema-template-trennen.md)
> und [`0004`](../docs/adr/0004-capture-publish-entkopplung-inbox-modell.md).
> Spezifikation: [`phase-2-test-library.md`](../docs/refactor/welle-3-vi-creation-wizard/phase-2-test-library.md) §5.

Eine Library, die **jede Mechanik genau einmal** ausübt — der reproduzierbare
Prüfstand, der heute fehlt (0 Wizard-Tests, „Testen" = Library-Hopping).

## Wichtig: zwei Reife-Grade der Fixtures

| Legende | Bedeutung |
|---|---|
| ✅ **RUNTIME** | Parst mit dem **heutigen** `parseTemplate` und ist sofort seedbar. Durch `tests/unit/templates/test-library-fixtures.test.ts` abgesichert. |
| 🎯 **TARGET** | Beschreibt das **Ziel-Modell** (ADR-0003 R1/R2). Felder wie `extends`, `relatedSchemas` und die `topicsVocabulary`-Config werden vom heutigen Runtime **noch nicht** konsumiert. Sie parsen als generische Frontmatter-Felder (kein Fehler), bleiben aber bis Phase 3 ohne Wirkung. |

Damit gilt: Diese Library ist **gleichzeitig** ein lauffähiger Prüfstand für
das Bestehende **und** ein ausführbares Modell-Dokument für das Geplante.

## Manifest (§5.1)

| Datei | docType / Renderer | Reife | Übt aus |
|---|---|---|---|
| [`templates/event.md`](templates/event.md) | `event` / `session` | ✅ | Story aus Ordner: `collectSource`+`selectFolderArtifacts`+`generateDraft`+`publish`, Quellen text/url/folder |
| [`templates/event-final.md`](templates/event-final.md) | `event` / `session` | 🎯 | **Schema-Extension** (`extends: event`), `selectRelatedTestimonials`, Multi-Source-Merge, R3 (System-Felder nicht editierbar) |
| [`templates/testimonial.md`](templates/testimonial.md) | `testimonial` / `testimonial` | ✅ | Quelle `spoken`, kurzes Schema, **related** zu `event` |
| [`templates/dialograum.md`](templates/dialograum.md) | `dialograum` / `blog` | ✅ | `selectRelatedTestimonials`, Quellen file+text |
| [`templates/pdfanalyse.md`](templates/pdfanalyse.md) | `pdfanalyse` / `book` | ✅/🎯 | **schema-only** (JobWorker, kein Wizard), nested Answer-Schema im systemprompt; **Schema-Config** via [`configs/`](configs/) ist 🎯 |
| [`templates/pc-steckbrief.md`](templates/pc-steckbrief.md) | `refurbedDevice` / `refurbedDevice` | ✅ | **Renderer-Drift** (previewDetail rendert Typ, den der Wizard nicht „kennt") |

→ Deckt alle Quelltypen (text/url/file/folder/spoken), beide Konsumenten
(Wizard + JobWorker), Renderer-Drift, Schema-Extension, Schema-Config und
Multi-Source-Merge ab.

## Schema-Config (R2) — [`configs/`](configs/)

`pdfanalyse` ist **ein** Schema + **ein** Extractor mit **drei** austauschbaren
Vokabular-Sets (statt 4 fast identischer Vorlagen):

- [`configs/pdfanalyse.commoning.json`](configs/pdfanalyse.commoning.json)
- [`configs/pdfanalyse.ecosocial.json`](configs/pdfanalyse.ecosocial.json)
- [`configs/pdfanalyse.klima.json`](configs/pdfanalyse.klima.json)

## Inbox-/Rechte-Fälle (ADR-0004)

Die Submission-Lebenszyklus-Fälle aus §5.2 sind **MongoDB-Laufzeitdaten** und
werden vom Seed-Skript erzeugt — siehe [`RUNBOOK-local.md`](RUNBOOK-local.md).

## Lokal benutzen

Diese Cloud-Session kann **keine DB seeden und nichts ausführen**. Die
DB-Schritte stehen in [`RUNBOOK-local.md`](RUNBOOK-local.md). In der Cloud
abgesichert ist nur die Parse-Schicht (Vitest-Test, siehe oben).
