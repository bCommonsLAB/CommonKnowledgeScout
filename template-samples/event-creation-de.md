---
title: {{title|Titel des Events}}
teaser: {{teaser|Kurzer Teaser-Text}}
date: {{date|Datum (ISO oder frei)}}
location: {{location|Ort}}
year: {{year|Jahr (z.B. 2026)}}
tags: {{tags|Tags (Array oder Text)}}
topics: {{topics|Themen (Array oder Text)}}

# System-Felder (werden im Wizard automatisch gesetzt, nicht im Formular anzeigen)
docType: {{docType|Wird automatisch gesetzt (event)}}
detailViewType: {{detailViewType|Wird automatisch gesetzt (session)}}
slug: {{slug|Wird automatisch gesetzt (aus Dateiname)}}
eventStatus: {{eventStatus|Wird automatisch gesetzt (open)}}
testimonialWriteKey: {{testimonialWriteKey|Wird automatisch gesetzt (für QR Upload)}}

creation:
  supportedSources:
    - id: text
      type: text
      label: "Text (tippen oder diktieren)"
      helpText: "Beschreibe den Event kurz. Titel, Ort, Datum und Ziel sind hilfreich."
    - id: url
      type: url
      label: "Webseite"
      helpText: "Importiere Informationen von einer Webseite"
    - id: folder
      type: folder
      label: "Verzeichnis mit Artefakten"
      helpText: "Audio, Video, PDF oder Office – alle bereits transkribiert"
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: CollectSource
        preset: collectSource
        title: "Quelle erfassen"
      - id: SelectArtifacts
        preset: selectFolderArtifacts
        title: "Artefakte auswählen"
      - id: Generate
        preset: generateDraft
        title: "Event-Details extrahieren"
      - id: Details
        preset: editDraft
        title: "Event-Details"
        fields:
          - title
          - teaser
          - date
          - location
          - year
          - tags
          - topics
      - id: Preview
        preset: previewDetail
        title: "Vorschau anzeigen"
      - id: Publish
        preset: publish
        title: "Fertigstellen"
        description: "Speichern & für die Suche indizieren."
  preview:
    detailViewType: session
  output:
    fileName:
      metadataFieldKey: title
      autoFillMetadataField: true
    createInOwnFolder: true
  ui:
    displayName: "Event erstellen"
    description: "Erstelle eine Event-Seite als Container (mit Platz für Testimonials)"
    icon: Calendar
---

{{bodyInText|Schreibe eine Event-Seite im Markdown-Format: zuerst 2-3 Sätze Kurzüberblick, dann Ziele, Ablauf, ggf. Agenda/Highlights.}}

--- systemprompt
Role:
- You extract structured event information from user input.

Return ONE valid JSON object only (no extra text):

{
  "title": "string",
  "teaser": "string",
  "date": "string",
  "location": "string",
  "year": "number|string",
  "tags": ["string"],
  "topics": ["string"],
  "bodyInText": "string (markdown body)"
}

