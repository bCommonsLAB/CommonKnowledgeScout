---
docType: event
detailViewType: session
title: {{title|Titel des Events}}
slug: {{slug|Kurz-Slug für URLs (optional)}}
summary: {{summary|Kurzbeschreibung des Events}}
event_date: {{event_date|Datum des Events (YYYY-MM-DD)}}
location: {{location|Ort des Events (optional)}}
filename: {{filename|Dateiname ohne .md (nur Wizard)}}
language: de
targetLanguage: de
source_language: de
creation:
  supportedSources:
    - id: text
      type: text
      label: "Text tippen oder diktieren"
      helpText: "Beschreibe das Event in eigenen Worten."
    - id: url
      type: url
      label: "Von einer URL"
      helpText: "Link zu Ankündigung, Programm oder Bericht."
    - id: folder
      type: folder
      label: "Aus einem Ordner"
      helpText: "Wähle einen Ordner mit Artefakten (Notizen, Videos, Bilder)."
  followWizards:
    testimonialTemplateId: testimonial
    finalizeTemplateId: event-final
  welcome:
    markdown: |
      ## Story aus Ordner

      Hier erfassen wir ein **Event** aus einer Quelle deiner Wahl: Freitext,
      einer URL oder einem ganzen **Ordner** mit Artefakten. Aus den Artefakten
      wählst du im nächsten Schritt aus, was in die Story einfließt.
  output:
    fileName:
      metadataFieldKey: title
      autoFillMetadataField: true
      extension: md
      fallbackPrefix: "event"
    createInOwnFolder: true
    wizardOnlyMetadataKeys:
      - filename
  preview:
    detailViewType: session
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: Collect
        preset: collectSource
        title: "Quelle wählen"
      - id: SelectArtifacts
        preset: selectFolderArtifacts
        title: "Artefakte auswählen"
        description: "Wähle aus dem Ordner, was in die Event-Story einfließt (Videos, Notizen, Bilder)."
      - id: Generate
        preset: generateDraft
        title: "Entwurf erzeugen"
      - id: Edit
        preset: editDraft
        title: "Felder prüfen"
        fields:
          - title
          - summary
          - event_date
          - location
          - filename
      - id: Preview
        preset: previewDetail
        title: "Vorschau"
      - id: Publish
        preset: publish
        title: "Veröffentlichen"
        ingestOnFinish: true
  ui:
    displayName: "Event erfassen (Story aus Ordner)"
    description: "Event aus Text, URL oder Ordner-Artefakten erstellen"
    icon: "Calendar"
---

# {{title}}

{{summary}}

--- systemprompt
Rolle:
- Du strukturierst eine Event-Story aus heterogenen Quellen (Freitext, URL-Inhalt
  oder ausgewählten Ordner-Artefakten) zu einem konsistenten Event-Dokument.

Hinweis:
- Verdichte die Quellen, ohne Fakten zu erfinden. Datum und Ort nur übernehmen,
  wenn sie belegt sind.

Antwortschema (JSON):
{ "title": "string", "summary": "string", "event_date": "string", "location": "string" }
