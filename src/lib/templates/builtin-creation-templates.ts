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
import { buildStandardCaptureFlowDoc } from '@/lib/creation/flow-seed'
import { STANDARD_CAPTURE_FLOW_ID } from '@/lib/creation/wizard-flow-entity'

/** Bekannte Built-in-Template-Namen (gleichzeitig API-/Wizard-`templateId`) */
export const BUILTIN_CREATION_TEMPLATE_NAMES = ['audio-transcript-de', 'file-transcript-de', 'website-de'] as const

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

      Hier erfassen wir ein **Diktat**: Unter „Erzähl mir was“ tippst oder sprichst du deinen Text. Danach nur noch **Dateiname** und **Veröffentlichen** — dein Beitrag landet im **Wartekorb** (als Owner sofort veröffentlicht).

      - Eine Quelle: Text (tippen oder diktieren)
      - Dein Text wird direkt übernommen
      - Dateiname eingeben und veröffentlichen
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
      - id: Publish
        preset: publish
        title: "Veröffentlichen"
        ingestOnFinish: false
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
  welcome:
    markdown: |
      ## Willkommen

      Hier **importierst** du eine Datei (PDF oder Audio) und wir **verarbeiten** sie für dich — der Beitrag landet danach im **Wartekorb** (als Owner sofort veröffentlicht).

      - Datei hochladen
      - Inhaltstyp wählen (z.B. Buch, Session)
      - Wir extrahieren bzw. transkribieren den Inhalt
      - Du prüfst das Ergebnis und legst es ab
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
      - id: SelectType
        preset: selectSchemaType
        title: "Inhaltstyp wählen"
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
    displayName: "Datei importieren und verarbeiten"
    description: "Datei hochladen, Inhalt automatisch extrahieren/transkribieren und als Beitrag in den Wartekorb legen"
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

const WEBSITE_DE_MD = `
---
docType: website
detailViewType: website
language: de
targetLanguage: de
title: {{title|Titel der Webseite (prägnant, max. 70 Zeichen)}}
hero_subtitle: {{hero_subtitle|Untertitel / Claim für den Hero-Bereich (1 Satz)}}
hero_image: {{hero_image|URL des prominentesten Bilds (Hero). Absolute URL von der Seite, sonst leer.}}
video_url: {{video_url|Embed-URL eines Videos (PeerTube/YouTube/Vimeo), falls vorhanden, sonst leer.}}
cta_label: {{cta_label|Beschriftung des wichtigsten Handlungsaufrufs (z.B. "Jetzt mitmachen"), sonst leer.}}
cta_url: {{cta_url|Ziel-URL des Handlungsaufrufs (absolute URL), sonst leer.}}
tags: {{tags|Themen-Tags als Array (z.B. ["klima", "engagement"])}}
slug: {{slug|Kurz-Slug für URLs (optional)}}
filename: {{filename|Dateiname ohne .md (nur Wizard)}}
creation:
  preview:
    detailViewType: website
  supportedSources:
    - id: url
      type: url
      label: "Webseite importieren"
      helpText: "Füge einen Link ein. Wir lesen Titel, Untertitel, Bilder und Inhalt aus und strukturieren sie als Landingpage."
    - id: text
      type: text
      label: "Text einfügen"
      helpText: "Alternativ den Inhalt direkt einfügen."
  welcome:
    markdown: |
      ## Webseite als Beitrag

      Importiere eine bestehende Webseite: Link einfügen, wir strukturieren sie als
      Landingpage — Hero, Inhalts-Sektionen, Video und Handlungsaufruf.

      - Automatische Extraktion von Titel, Untertitel und Hero-Bild
      - Inhalt wird in Sektionen gegliedert (Markdown)
      - Du kannst alles vor dem Speichern anpassen
  output:
    fileName:
      metadataFieldKey: title
      autoFillMetadataField: true
      extension: md
      fallbackPrefix: "webseite"
    createInOwnFolder: false
    wizardOnlyMetadataKeys:
      - filename
  flow:
    steps:
      - id: Welcome
        preset: welcome
        title: "Willkommen"
      - id: CollectSource
        preset: collectSource
        title: "Webseite-Link"
      - id: Generate
        preset: generateDraft
        title: "Webseite strukturieren"
      - id: Details
        preset: editDraft
        title: "Inhalt prüfen"
        fields:
          - title
          - hero_subtitle
          - hero_image
          - video_url
          - cta_label
          - cta_url
          - tags
      - id: Preview
        preset: previewDetail
        title: "Vorschau"
      - id: Publish
        preset: publish
        title: "Speichern"
        description: "Die Webseite wird als Beitrag gespeichert und muss noch publiziert werden."
        ingestOnFinish: false
  ui:
    displayName: "Webseite importieren"
    description: "Eine bestehende Webseite als Landingpage-Beitrag erfassen"
    icon: "Globe"
---

{{website_body|Gib den Hauptinhalt der Seite als Markdown aus, OHNE den Hero (Titel, Untertitel, Hero-Bild) zu wiederholen. Gliedere den Inhalt in Sektionen mit HTML-Kommentar-Markern im Format <!-- section layout=image-right bg=light --> ... <!-- /section -->. Jede Sektion: eine H2-Überschrift, optional ein Bild ![alt](url) und Absätze. Erlaubte layout-Werte: image-left, image-right, full-image, text-only. Erlaubte bg-Werte: default, light, dark, brand. Wechsle Bild-Positionen sinnvoll ab; Zitate als Blockquote in einer text-only-Sektion. Verwende nur Bild-URLs, die auf der Seite vorkommen. Erfinde nichts.}}

--- systemprompt
Rolle:
- Du strukturierst eine bestehende Webseite zu einer Landingpage: flache Hero-/Meta-Felder + ein gegliederter Markdown-Body.

Anweisung:
- Extrahiere die Hero-/Meta-Felder (title, hero_subtitle, hero_image, video_url, cta_label, cta_url, tags) aus dem Seiteninhalt.
- hero_image, video_url, cta_url, cta_label: nur ausfüllen, wenn klar erkennbar, sonst leer ("").
- website_body: der Hauptinhalt als Markdown, gegliedert mit Sektions-Markern (siehe Body-Anweisung). Den Hero NICHT wiederholen.
- Verwende ausschließlich Inhalte und Bild-URLs, die in den Quellen vorkommen. Keine Halluzinationen, keine erfundenen Zitate oder Zahlen.
- Antworte ausschließlich mit einem gültigen JSON-Objekt.

Antwortschema (MUSS exakt ein JSON-Objekt sein):
{
  "title": "string",
  "hero_subtitle": "string",
  "hero_image": "string (URL oder leer)",
  "video_url": "string (URL oder leer)",
  "cta_label": "string",
  "cta_url": "string (URL oder leer)",
  "tags": "string[]",
  "slug": "string",
  "website_body": "string (Markdown mit Sektions-Markern)"
}
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
  if (name === 'website-de') {
    const { template } = parseTemplate(WEBSITE_DE_MD, 'website-de')
    return parsedToDocument('website-de', template, libraryId, userEmail)
  }
  // W-D: Der generische Standard-Flow wird aus dem Code geliefert (Code-Fallback,
  // kein Mongo-Seed noetig). Ein per W-A-2 geseedeter, editierbarer Flow gewinnt,
  // weil der Config-Route-Loader zuerst MongoDB fragt.
  if (name === STANDARD_CAPTURE_FLOW_ID) {
    const now = new Date()
    return {
      ...buildStandardCaptureFlowDoc(libraryId, userEmail),
      _id: name,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
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
