/**
 * @fileoverview Built-in Creation-Templates (Variante A)
 *
 * Zentrale, hardcodierte Standard-Templates für „Content erstellen“, ohne MongoDB-Seed.
 * Library-Templates mit gleichem `name` überschreiben diese Einträge.
 *
 * @see docs/analysis/builtin-creation-templates.md (optional)
 */

import { parseTemplate } from '@/lib/templates/template-parser'
import type { TemplateDocument } from '@/lib/templates/template-types'

/** Bekannte Built-in-Template-Namen (gleichzeitig API-/Wizard-`templateId`) */
export const BUILTIN_CREATION_TEMPLATE_NAMES = ['audio-transcript-de', 'file-transcript-de'] as const

export type BuiltinCreationTemplateName = (typeof BUILTIN_CREATION_TEMPLATE_NAMES)[number]

const AUDIO_TRANSCRIPT_DE_MD = `
---
docType: transcript
detailViewType: session
title: {{title|Titel des Dokuments (z.B. aus Inhalt)}}
slug: {{slug|Kurz-Slug für URLs (optional)}}
summary: {{summary|Kurzbeschreibung (optional)}}
filename: {{filename|Dateiname ohne Markdown-Endung (nur Wizard)}}
source_language: de
creation:
  supportedSources:
    - id: text
      type: text
      label: "Text tippen oder diktieren"
      helpText: "Tippe deinen Text oder nutze das Mikrofon. Der Inhalt wird als Transkript übernommen; du kannst ihn vor dem Speichern bearbeiten."
  welcome:
    markdown: |
      ## Willkommen

      Hier erfassen wir ein **Diktat**: Unter „Erzähl mir was“ tippst oder sprichst du deinen Text. Danach nur noch **Dateiname** und Speichern — die Datei landet im **aktuellen Ordner**, ohne Extra-Unterordner.

      - Eine Quelle: Text (tippen oder diktieren)
      - Dein Text wird direkt übernommen
      - Dateiname eingeben und fertig
  output:
    fileName:
      metadataFieldKey: title
      autoFillMetadataField: true
      extension: md
      fallbackPrefix: "diktat-transcript"
    createInOwnFolder: false
    wizardOnlyMetadataKeys:
      - filename
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: Collect
        preset: collectSource
        title: "Erzähl mir was"
      - id: Filename
        preset: editDraft
        title: "Dateiname"
        description: "Nur der Dateiname (ohne Endung md). Der Text aus dem vorigen Schritt wird übernommen."
        fields:
          - filename
  ui:
    displayName: "Diktat erfassen"
    description: "Text tippen oder diktieren und als bearbeitbares Transkript speichern"
    icon: "Mic"
---

# {{title}}

{{summary}}

--- systemprompt
Rolle:
- Hilfs-Template für Diktat-/Transkript-Flows im Creation-Wizard (Textquelle, kein Datei-Upload).

Hinweis:
- Der Nutzer liefert Freitext; die Ausgabe ist das bearbeitbare Markdown mit Metadaten.

Antwortschema (JSON):
{ "title": "string", "summary": "string" }
`.trim()

const FILE_TRANSCRIPT_DE_MD = `
---
docType: transcript
detailViewType: session
title: {{title|Titel des Dokuments}}
slug: {{slug|Kurz-Slug (optional)}}
summary: {{summary|Kurzbeschreibung (optional)}}
filename: {{filename|Dateiname für die Markdown-Datei ohne .md (nur Wizard)}}
sourceType: {{sourceType|Art der Quelldatei (z.B. pdf, audio, image, video)}}
creation:
  supportedSources:
    - id: file
      type: file
      label: "Datei hochladen"
      helpText: "PDF, Audio, Bild oder Video. Inhalt wird extrahiert bzw. transkribiert; Ergebnis vor dem Speichern editierbar."
  output:
    fileName:
      metadataFieldKey: title
      autoFillMetadataField: true
      extension: md
      fallbackPrefix: "file-transcript"
    createInOwnFolder: true
    wizardOnlyMetadataKeys:
      - filename
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: Collect
        preset: collectSource
        title: "Datei auswählen"
      - id: Review
        preset: editDraft
        title: "Inhalt und Dateiname prüfen"
        fields:
          - title
          - summary
          - filename
      - id: Publish
        preset: publish
        title: "Speichern"
        ingestOnFinish: false
  ui:
    displayName: "Datei transkribieren"
    description: "Datei hochladen, Inhalt extrahieren und als bearbeitbares Transkript speichern"
    icon: "Upload"
---

# {{title}}

{{summary}}

--- systemprompt
Rolle:
- Hilfs-Template für generische Datei-Transkript-/Extraktions-Flows.

Antwortschema (JSON):
{ "title": "string", "summary": "string", "sourceType": "string" }
`.trim()

function parsedToDocument(
  name: string,
  parsed: ReturnType<typeof parseTemplate>['template'],
  libraryId: string,
  userEmail: string
): TemplateDocument {
  const now = new Date()
  return {
    _id: name,
    name,
    libraryId,
    user: userEmail,
    metadata: parsed.metadata,
    systemprompt: parsed.systemprompt,
    markdownBody: parsed.markdownBody,
    creation: parsed.creation,
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
}

/**
 * Liefert ein Built-in-Template-Dokument für eine Library (Platzhalter owner/library).
 */
export function getBuiltinCreationTemplate(
  templateName: string,
  libraryId: string,
  userEmail: string
): TemplateDocument | null {
  const name = templateName.trim()
  if (name === 'audio-transcript-de') {
    const { template } = parseTemplate(AUDIO_TRANSCRIPT_DE_MD, 'audio-transcript-de')
    return parsedToDocument('audio-transcript-de', template, libraryId, userEmail)
  }
  if (name === 'file-transcript-de') {
    const { template } = parseTemplate(FILE_TRANSCRIPT_DE_MD, 'file-transcript-de')
    return parsedToDocument('file-transcript-de', template, libraryId, userEmail)
  }
  return null
}

/** Alle Built-ins für Merge/Listen (ohne Netzwerk). */
export function listBuiltinCreationTemplates(libraryId: string, userEmail: string): TemplateDocument[] {
  const out: TemplateDocument[] = []
  for (const n of BUILTIN_CREATION_TEMPLATE_NAMES) {
    const t = getBuiltinCreationTemplate(n, libraryId, userEmail)
    if (t) out.push(t)
  }
  return out
}

/**
 * True, wenn dieser Template-Name ein Built-in ist (unabhängig davon, ob in Mongo überschrieben).
 */
export function isBuiltinCreationTemplateName(name: string): boolean {
  return (BUILTIN_CREATION_TEMPLATE_NAMES as readonly string[]).includes(name.trim())
}
