---
title: {{title|Titel des Dialograums}}
teaser: {{teaser|Kurzer Teaser-Text}}
date: {{date|Datum des Dialograums}}
location: {{location|Ort}}
description: {{description|Beschreibung des Dialograums}}
dialograum_id: {{dialograum_id|Eindeutige ID des Dialograums (wird automatisch generiert)}}
creation:
  supportedSources:
    - id: text
      type: text
      label: "Text (tippen oder diktieren)"
      helpText: "Beschreibe den Dialograum, die Themen und Ziele."
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: Details
        preset: editDraft
        title: "Dialograum-Details"
        fields:
          - title
          - teaser
          - date
          - location
          - description
          - dialograum_id
      - id: Preview
        preset: previewDetail
        title: "Vorschau anzeigen"
  preview:
    detailViewType: session
  ui:
    displayName: "Dialograum erstellen"
    description: "Erstelle einen Dialograum für eine Veranstaltung"
    icon: Users
---

{{bodyInText|Beschreibe den Dialograum: Ziele, Themen, Format und Ablauf.}}

--- systemprompt
Role:
- You extract structured dialograum information from user input.

Return ONE valid JSON object only (no extra text):

{
  "title": "string",
  "teaser": "string",
  "date": "string",
  "location": "string",
  "description": "string",
  "dialograum_id": "string (generiere eine eindeutige UUID oder Slug)",
  "bodyInText": "string (markdown body)"
}

