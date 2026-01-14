---
title: {{title|Titel des finalen Events}}
teaser: {{teaser|Kurzüberblick (1-2 Sätze)}}

# System-Felder (werden automatisch aus dem Original gesetzt)
slug: {{slug|Wird automatisch gesetzt (slug des Original-Events)}}
originalFileId: {{originalFileId|Wird automatisch gesetzt (fileId des Original-Events)}}
eventStatus: {{eventStatus|finalDraft}}
finalRunId: {{finalRunId|Wird automatisch gesetzt (run-<timestamp>)}}

creation:
  supportedSources:
    - id: file
      type: file
      label: "Event + Testimonials (aus Seed)"
      helpText: "Dieser Wizard wird aus einem Event gestartet und nutzt automatisch Event+Testimonials als Quellen. Alle Testimonials sind standardmäßig ausgewählt."
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
      - id: Publish
        preset: publish
        title: "Veröffentlichen"
  preview:
    detailViewType: session
  output:
    fileName:
      fallbackPrefix: "event-final"
      extension: md
    createInOwnFolder: true
  ui:
    displayName: "Event finalisieren"
    description: "Erzeugt einen finalen Event-Entwurf aus Event+Testimonials und veröffentlicht ihn"
    icon: Sparkles
---

{{bodyInText|Schreibe eine Event-Seite im Markdown-Format: zuerst 2-3 Sätze Kurzüberblick, was im Event behandelt wurde Ziele, Ablauf, ggf. Agenda/Highlights.}}

## Eindruck der Teilnehmer
{{EindruckDerTeilnehmer|Was war der Eindruck der Teilnehmer? Was nehmen sie mit und warum? Was war gemeinsam und was gegensätzlich?}}

## Testimonials
{{Testimonials|Können wir die Testimonials nochmal auflisten und ihre wichtigsten Aussagen ausgeben?}}

--- systemprompt
Role:
- You create a final event page from an original event text and multiple testimonial sources.
- Use the provided sources (event text + testimonials) to summarize what happened and what participants took away.

Return ONE valid JSON object only (no extra text):

{
  "title": "string",
  "teaser": "string",
  "bodyInText": "string (markdown body)",
  "EindruckDerTeilnehmer": "string (markdown or text)",
  "Testimonials": "string (markdown list or text)"
}

