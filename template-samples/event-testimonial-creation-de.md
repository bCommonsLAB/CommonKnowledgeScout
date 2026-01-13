---
title: {{title|Kurzer Titel (optional)}}

# Antworten / Inhalte
q1_experience: {{q1_experience|Wie hast du den Event erlebt?}}
q2_key_insight: {{q2_key_insight|Was war deine wichtigste Erkenntnis?}}
q3_why_important: {{q3_why_important|Warum ist das wichtig?}}

# Autor / Kontext (optional)
speakerName: {{speakerName|Name (optional)}}

# System-Felder (werden beim Start aus dem Event gesetzt)
source_event_file_id: {{source_event_file_id|Wird automatisch gesetzt (Event fileId)}}

creation:
  supportedSources:
    - id: spoken
      type: spoken
      label: "Stimme aufnehmen"
      helpText: "Sprich frei. Wir transkribieren und erzeugen daraus ein Testimonial."
    - id: text
      type: text
      label: "Text (tippen oder diktieren)"
      helpText: "Alternativ kannst du direkt tippen."
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: Collect
        preset: collectSource
        title: "Input erfassen"
      - id: Generate
        preset: generateDraft
        title: "Auswertung"
      - id: Review
        preset: editDraft
        title: "Feinschliff"
        fields:
          - q1_experience
          - q2_key_insight
          - q3_why_important
          - speakerName
          - source_event_file_id
      - id: Preview
        preset: previewDetail
        title: "Vorschau"
  preview:
    detailViewType: testimonial
  output:
    fileName:
      fallbackPrefix: "testimonial"
      extension: md
    createInOwnFolder: true
  ui:
    displayName: "Testimonial aufnehmen"
    description: "Stimme/Text erfassen und als Testimonial speichern"
    icon: MessageSquare
---

{{bodyInText|Schreibe ein kurzes, gut lesbares Testimonial im Markdown-Format. Zuerst 2-3 Sätze Überblick, dann die Antworten strukturiert.}}

--- systemprompt
Role:
- You extract structured testimonial information from user input.

Return ONE valid JSON object only (no extra text):

{
  "q1_experience": "string",
  "q2_key_insight": "string",
  "q3_why_important": "string",
  "speakerName": "string",
  "bodyInText": "string (markdown body)"
}

