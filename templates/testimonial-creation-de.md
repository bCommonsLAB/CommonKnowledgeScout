---
title: {{title|Titel des Testimonials}}
teaser: {{teaser|Kurzer Teaser-Text}}
q1_experience: {{q1_experience|Wie hast du den Event erlebt?}}
q2_key_insight: {{q2_key_insight|Was war deine wichtigste Erkenntnis?}}
q3_why_important: {{q3_why_important|Warum ist das wichtig?}}
author_name: {{author_name|Vollständiger Name}}
author_role: {{author_role|Rolle / Organisation}}
author_nickname: {{author_nickname|Nickname (für halb-anonyme Veröffentlichung)}}
author_is_named: {{author_is_named|Ich möchte namentlich auftreten (true/false)}}
author_image_url: {{author_image_url|Bild oder Selfie}}
dialograum_id: {{dialograum_id|ID des Dialograums (wird automatisch gesetzt)}}
creation:
  supportedSources:
    - id: text
      type: text
      label: "Text (tippen oder diktieren)"
      helpText: "Beantworte die Fragen schriftlich oder nutze das Diktieren, um Zeit zu sparen."
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: Questions
        preset: editDraft
        title: "Testimonial erfassen"
        fields:
          - q1_experience
          - q2_key_insight
          - q3_why_important
      - id: Personal
        preset: editDraft
        title: "Persönliche Angaben"
        fields:
          - author_name
          - author_role
          - author_nickname
          - author_is_named
          - author_image_url
          - dialograum_id
        imageFieldKeys:
          - author_image_url
      - id: Preview
        preset: previewDetail
        title: "Vorschau anzeigen"
  preview:
    detailViewType: testimonial
  ui:
    displayName: "Testimonial erfassen"
    description: "Erfasse ein Testimonial mit Fragen und persönlichen Angaben"
    icon: MessageSquare
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text: zuerst 2-3 Sätze Kurzüberblick, dann die Fragen/Antworten strukturiert darstellen.}}

--- systemprompt
Role:
- You extract structured testimonial information from user input.

Return ONE valid JSON object only (no extra text):

{
  "title": "string",
  "teaser": "string",
  "q1_experience": "string",
  "q2_key_insight": "string",
  "q3_why_important": "string",
  "author_name": "string",
  "author_role": "string",
  "author_nickname": "string",
  "author_is_named": true,
  "dialograum_id": "string (optional, wird automatisch gesetzt wenn über Dialograum-Link gestartet)",
  "bodyInText": "string (markdown body)"
}

