---
title: {{title|Titel des Dialograum-Ergebnisses}}
teaser: {{teaser|Kurzer Teaser-Text}}
date: {{date|Datum des Dialograums}}
location: {{location|Ort}}
summary: {{summary|Zusammenfassung des Dialograums}}
participant_count: {{participant_count|Anzahl der Teilnehmer}}
dialograum_id: {{dialograum_id|ID des ursprünglichen Dialograums}}
source_dialog_file_id: {{source_dialog_file_id|File-ID der Dialograum-Datei}}
source_testimonial_file_ids: {{source_testimonial_file_ids|Array der File-IDs der Testimonials}}
creation:
  supportedSources:
    - id: file
      type: file
      label: "Datei aus Library auswählen"
      helpText: "Wähle die Dialograum-Datei aus."
    - id: text
      type: text
      label: "Text (optional)"
      helpText: "Zusätzliche Notizen oder Ergänzungen."
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: SelectDialograum
        preset: collectSource
        title: "Dialograum auswählen"
      - id: SelectTestimonials
        preset: selectRelatedTestimonials
        title: "Testimonials prüfen"
      - id: Generate
        preset: generateDraft
        title: "Ergebnis generieren"
      - id: Edit
        preset: editDraft
        title: "Ergebnis bearbeiten"
        fields:
          - title
          - teaser
          - date
          - location
          - summary
          - participant_count
      - id: Preview
        preset: previewDetail
        title: "Vorschau anzeigen"
  preview:
    detailViewType: session
  ui:
    displayName: "Dialograum Ergebnis"
    description: "Erstelle ein konsolidiertes Ergebnis aus Dialograum und Testimonials"
    icon: FileText
---

{{bodyInText|Erstelle eine strukturierte Zusammenfassung: 
1. Kurze Einleitung zum Dialograum
2. Zusammenfassung der wichtigsten Erkenntnisse aus den Testimonials
3. Gemeinsame Themen und Muster
4. Offene Fragen oder nächste Schritte}}

--- systemprompt
Role:
- You consolidate information from a dialograum (event) and multiple testimonials into a structured result document.
- Extract key themes, insights, and patterns from the testimonials.
- Create a coherent narrative that summarizes the dialograum experience.

Input structure:
- Dialograum: {title, teaser, date, location, description, body}
- Testimonials: Array of {author_name, author_role, q1_experience, q2_key_insight, q3_why_important, body}

Return ONE valid JSON object only (no extra text):

{
  "title": "string (Dialograum-Titel + ' - Ergebnis')",
  "teaser": "string (Kurzfassung der wichtigsten Erkenntnisse)",
  "date": "string (aus Dialograum)",
  "location": "string (aus Dialograum)",
  "summary": "string (Zusammenfassung des Dialogs und der Teilnehmerstimmen)",
  "participant_count": number (Anzahl der Testimonials),
  "bodyInText": "string (markdown body: strukturierte Zusammenfassung mit Erkenntnissen)"
}

