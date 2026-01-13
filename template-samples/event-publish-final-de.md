---
originalFileId: {{originalFileId|Wird aus der Final-Datei übernommen}}
slug: {{slug|Wird aus der Final-Datei übernommen}}
creation:
  supportedSources:
    - id: file
      type: file
      label: "Final-Datei (Resume)"
      helpText: "Dieser Wizard wird aus einer Final-Datei gestartet und veröffentlicht sie."
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Final veröffentlichen"
      - id: Publish
        preset: publish
        title: "Publizieren"
        description: "Final wird ingestiert und der Original-Event aus dem Index entfernt."
  ui:
    displayName: "Event final veröffentlichen"
    description: "Publiziert eine Final-Datei (Index-Swap)"
    icon: Upload
---

{{bodyInText|Dieser Wizard veröffentlicht eine bereits erzeugte Final-Datei.}}

--- systemprompt
Role:
- No transformation. This is a publish-only flow.

Return ONE valid JSON object only (no extra text):

{
  "bodyInText": "string"
}

