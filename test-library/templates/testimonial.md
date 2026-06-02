---
docType: testimonial
detailViewType: testimonial
title: {{title|Kurztitel des Testimonials}}
statement: {{statement|Das eigentliche Zitat / die Aussage}}
author_name: {{author_name|Name der sprechenden Person}}
author_image_url: {{author_image_url|Porträtbild (optional)}}
filename: {{filename|Dateiname ohne .md (nur Wizard)}}
source_language: de
# related: dieses Schema bezieht sich auf event (Quelle/Kontext)
relatedSchemas: event
creation:
  supportedSources:
    - id: spoken
      type: spoken
      label: "Diktieren"
      helpText: "Sprich dein Testimonial ein. Die Aussage wird transkribiert und ist vor dem Speichern editierbar."
  welcome:
    markdown: |
      ## Testimonial erfassen

      Sprich kurz, was dich bewegt hat. Wir machen daraus ein zitierfähiges
      **Testimonial** — du prüfst Text und Namen vor dem Speichern.
  output:
    fileName:
      metadataFieldKey: author_name
      autoFillMetadataField: true
      extension: md
      fallbackPrefix: "testimonial"
    createInOwnFolder: false
    wizardOnlyMetadataKeys:
      - filename
  preview:
    detailViewType: testimonial
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: Collect
        preset: collectSource
        title: "Diktieren"
      - id: Edit
        preset: editDraft
        title: "Aussage prüfen"
        fields:
          - title
          - statement
          - author_name
          - author_image_url
          - filename
        imageFieldKeys:
          - author_image_url
      - id: Publish
        preset: publish
        title: "Speichern"
        ingestOnFinish: false
  ui:
    displayName: "Testimonial erfassen"
    description: "Gesprochenes Testimonial diktieren und als Zitat speichern"
    icon: "MessageSquare"
---

# {{title}}

> {{statement}}
>
> — {{author_name}}

--- systemprompt
Rolle:
- Du formst eine gesprochene, ggf. unstrukturierte Aussage zu einem klaren,
  zitierfähigen Testimonial. Stil glätten, Inhalt nicht verändern.

Antwortschema (JSON):
{ "title": "string", "statement": "string", "author_name": "string" }
