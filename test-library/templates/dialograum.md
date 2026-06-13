---
docType: dialograum
detailViewType: blog
title: {{title|Titel des Dialograum-Ergebnisses}}
slug: {{slug|Kurz-Slug für URLs (optional)}}
summary: {{summary|Zusammenfassung des Ergebnisses}}
result_text: {{result_text|Das ausformulierte Ergebnis des Dialograums}}
filename: {{filename|Dateiname ohne .md (nur Wizard)}}
language: de
targetLanguage: de
source_language: de
relatedSchemas: testimonial
creation:
  supportedSources:
    - id: file
      type: file
      label: "Datei hochladen"
      helpText: "Protokoll, Foto eines Flipcharts oder Audiomitschnitt."
    - id: text
      type: text
      label: "Text tippen oder diktieren"
      helpText: "Fasse das Ergebnis in eigenen Worten zusammen."
  welcome:
    markdown: |
      ## Dialograum-Ergebnis

      Halte das **Ergebnis** eines Dialograums fest — als Datei oder Freitext.
      Im nächsten Schritt kannst du passende Testimonials zuordnen.
  output:
    fileName:
      metadataFieldKey: title
      autoFillMetadataField: true
      extension: md
      fallbackPrefix: "dialograum"
    createInOwnFolder: true
    wizardOnlyMetadataKeys:
      - filename
  preview:
    detailViewType: blog
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: Collect
        preset: collectSource
        title: "Quelle wählen"
      - id: SelectTestimonials
        preset: selectRelatedTestimonials
        title: "Testimonials zuordnen"
        description: "Wähle Testimonials, die zu diesem Ergebnis gehören."
      - id: Generate
        preset: generateDraft
        title: "Entwurf erzeugen"
      - id: Edit
        preset: editDraft
        title: "Ergebnis prüfen"
        fields:
          - title
          - summary
          - result_text
          - filename
      - id: Publish
        preset: publish
        title: "Veröffentlichen"
        ingestOnFinish: true
  ui:
    displayName: "Dialograum-Ergebnis erfassen"
    description: "Ergebnis eines Dialograums aus Datei oder Text festhalten"
    icon: "Users"
---

# {{title}}

{{summary}}

{{result_text}}

--- systemprompt
Rolle:
- Du verdichtest Rohmaterial (Protokoll/Foto/Audio oder Freitext) plus
  zugeordnete Testimonials zu einem lesbaren Dialograum-Ergebnis.

Antwortschema (JSON):
{ "title": "string", "summary": "string", "result_text": "string" }
