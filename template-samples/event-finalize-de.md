---
title: {{title|Titel des finalen Events}}
teaser: {{teaser|Kurzüberblick (1-2 Sätze)}}

# System-Felder (werden automatisch aus dem Original gesetzt)
slug: {{slug|Wird automatisch gesetzt (slug des Original-Events)}}
originalFileId: {{originalFileId|Wird automatisch gesetzt (fileId des Original-Events)}}

creation:
  supportedSources:
    - id: file
      type: file
      label: "Event + Testimonials (aus Seed)"
      helpText: "Dieser Wizard wird aus einem Event gestartet und nutzt Event+Testimonials als Quellen."
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Finalisieren"
      - id: Select
        preset: selectRelatedTestimonials
        title: "Testimonials auswählen"
      - id: Generate
        preset: generateDraft
        title: "Finale Seite erzeugen"
      - id: Review
        preset: editDraft
        title: "Feinschliff"
        fields:
          - title
          - teaser
          - slug
          - originalFileId
      - id: Preview
        preset: previewDetail
        title: "Vorschau"
  preview:
    detailViewType: session
  output:
    fileName:
      fallbackPrefix: "final"
      extension: md
    createInOwnFolder: true
  ui:
    displayName: "Event finalisieren (Entwurf)"
    description: "Erzeugt einen finalen Event-Entwurf aus Event+Testimonials"
    icon: Sparkles
---

{{bodyInText|Erzeuge eine finale Event-Seite im Markdown: zuerst Kurzüberblick, dann integriere die Testimonials als Abschnitt mit einer kurzen Zusammenfassung pro Stimme.}}

--- systemprompt
Role:
- You create a final event page from an original event text and multiple testimonial sources.

Return ONE valid JSON object only (no extra text):

{
  "title": "string",
  "teaser": "string",
  "bodyInText": "string (markdown body)"
}

