---
# 🎯 TARGET-Fixture (ADR-0003 R1/R3): `extends` + `relatedSchemas` werden vom
# heutigen Runtime NOCH NICHT konsumiert. Sie parsen als generische Felder.
docType: event
detailViewType: session
extends: event
relatedSchemas: testimonial
title: {{title|Titel des Events}}
summary: {{summary|Kurzbeschreibung des Events}}
bodyInText: {{bodyInText|Ausformulierter Fließtext des finalen Berichts}}
eindruckDerTeilnehmer: {{eindruckDerTeilnehmer|Verdichteter Eindruck der Teilnehmenden}}
testimonials: {{testimonials|Eingebundene Testimonials (aus selectRelatedTestimonials)}}
source_language: de
# --- System-Felder (R3): auto-gesetzt, NIE als editDraft-Feld binden ---
# slug, originalFileId, finalRunId, eventStatus
creation:
  supportedSources:
    - id: text
      type: text
      label: "Notiz hinzufügen"
      helpText: "Optionaler Freitext für den finalen Bericht."
  relatedSchemas:
    - testimonial
  welcome:
    markdown: |
      ## Event finalisieren

      Aus einem bestehenden Event + ausgewählten Testimonials erzeugen wir den
      **finalen Bericht**. Quellen werden zu *einer* Seite verdichtet
      (Multi-Source-Merge). System-Felder bleiben automatisch gesetzt.
  output:
    fileName:
      metadataFieldKey: title
      autoFillMetadataField: true
      extension: md
      fallbackPrefix: "event-final"
    createInOwnFolder: true
    wizardOnlyMetadataKeys: []
  preview:
    detailViewType: session
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: SelectTestimonials
        preset: selectRelatedTestimonials
        title: "Testimonials auswählen"
        description: "Wähle die Testimonials, die in den finalen Bericht einfließen."
      - id: Generate
        preset: generateDraft
        title: "Finalen Entwurf erzeugen"
      - id: Edit
        preset: editDraft
        title: "Bericht prüfen"
        # R3: NUR Inhalts-Felder. KEINE System-Felder (slug/originalFileId/...).
        fields:
          - title
          - summary
          - bodyInText
          - eindruckDerTeilnehmer
          - testimonials
      - id: Preview
        preset: previewDetail
        title: "Vorschau"
      - id: Publish
        preset: publish
        title: "Veröffentlichen (Index-Swap)"
        ingestOnFinish: true
  ui:
    displayName: "Event finalisieren"
    description: "Bestehendes Event + Testimonials zu finalem Bericht verdichten"
    icon: "FileCheck"
---

# {{title}}

{{summary}}

{{bodyInText}}

--- systemprompt
Rolle:
- Du verdichtest ein bestehendes Event und N ausgewählte Testimonials (Quellen-
  seitiger Multi-Source-Merge) zu einem finalen, publikationsreifen Bericht.

Hinweis (R3):
- System-Felder (slug, originalFileId, finalRunId, eventStatus) werden NICHT vom
  Modell befüllt; sie sind auto-gesetzt und nicht editierbar.

Antwortschema (JSON):
{ "title": "string", "summary": "string", "bodyInText": "string", "eindruckDerTeilnehmer": "string", "testimonials": "string" }
