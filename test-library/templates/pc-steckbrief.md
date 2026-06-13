---
docType: refurbedDevice
detailViewType: refurbedDevice
title: {{title|Gerätename / Modell}}
slug: {{slug|Kurz-Slug für URLs (optional)}}
device_type: {{device_type|Geräteart (z.B. Laptop, Desktop)}}
cpu: {{cpu|Prozessor}}
ram_gb: {{ram_gb|Arbeitsspeicher in GB}}
storage_gb: {{storage_gb|Speicher in GB}}
condition_grade: {{condition_grade|Zustandsnote (A/B/C)}}
filename: {{filename|Dateiname ohne .md (nur Wizard)}}
source_language: de
creation:
  supportedSources:
    - id: text
      type: text
      label: "Daten eingeben"
      helpText: "Trage die Eckdaten des refurbishten Geräts ein."
  welcome:
    markdown: |
      ## Geräte-Steckbrief

      Erfasse die Eckdaten eines refurbishten Geräts. **Renderer-Drift-Fall**:
      Die Vorschau rendert `refurbedDevice` — einen Typ, den der generische
      Wizard-Preview-Pfad nicht eigens kennt.
  output:
    fileName:
      metadataFieldKey: title
      autoFillMetadataField: true
      extension: md
      fallbackPrefix: "steckbrief"
    createInOwnFolder: false
    wizardOnlyMetadataKeys:
      - filename
  preview:
    detailViewType: refurbedDevice
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: Collect
        preset: collectSource
        title: "Daten eingeben"
      - id: Edit
        preset: editDraft
        title: "Steckbrief prüfen"
        fields:
          - title
          - device_type
          - cpu
          - ram_gb
          - storage_gb
          - condition_grade
          - filename
      - id: Preview
        preset: previewDetail
        title: "Vorschau (Renderer-Drift)"
      - id: Publish
        preset: publish
        title: "Speichern"
        ingestOnFinish: false
  ui:
    displayName: "Geräte-Steckbrief erfassen"
    description: "Refurbished-Gerät als Steckbrief erfassen (Renderer-Drift-Fall)"
    icon: "Laptop"
---

# {{title}}

{{device_type}} · {{cpu}} · {{ram_gb}} GB RAM · {{storage_gb}} GB · Zustand {{condition_grade}}

--- systemprompt
Rolle:
- Du normalisierst frei eingegebene Geräte-Eckdaten zu einem strukturierten
  Steckbrief. Keine Werte erfinden; fehlende Angaben leer lassen.

Antwortschema (JSON):
{ "title": "string", "device_type": "string", "cpu": "string", "ram_gb": "string", "storage_gb": "string", "condition_grade": "string" }
