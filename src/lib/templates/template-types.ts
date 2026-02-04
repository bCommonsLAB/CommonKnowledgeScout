/**
 * @fileoverview TypeScript-Typen für Template-Schema
 * 
 * @description
 * Zentrale Typdefinitionen für Templates, die drei Schichten klar trennen:
 * 1. Metadata/Schema (Frontmatter-Felder)
 * 2. Transformationslogik (systemprompt)
 * 3. UX-Creation-Flow (creation-Block)
 * 
 * Diese Typen werden vom TemplateService verwendet, um Templates zu parsen,
 * zu validieren und Views für unterschiedliche Consumer bereitzustellen.
 */

/**
 * Unterstützte Source-Typen für Creation-Inputs
 */
export type CreationSourceType = 'spoken' | 'url' | 'text' | 'file'

/**
 * Definition einer unterstützten Input-Quelle für den Creation-Wizard
 */
export interface CreationSource {
  /** Eindeutige ID dieser Quelle (z.B. 'spoken', 'url') */
  id: string
  /** Typ der Quelle */
  type: CreationSourceType
  /** Label für die UI */
  label: string
  /** Optionaler Hilfetext */
  helpText?: string
}

/**
 * Unterstützte Step-Presets im Creation-Flow
 * 
 * - `welcome`: Willkommensseite am Anfang des Wizards
 * - `collectSource`: Quelle sammeln (zeigt Quelle-Auswahl wenn keine ausgewählt, sonst entsprechenden Dialog)
 * - `generateDraft`: LLM-Transformation der Eingabe zu strukturierten Daten + Markdown (optional, wird in Multi-Source-Flow automatisch übersprungen)
 * - `editDraft`: Formular-Modus: direkte Bearbeitung aller Metadaten + Markdown-Draft (mit Feld-Auswahl)
 * - `uploadImages`: Optionaler Step zum Hochladen von Bildern für konfigurierte Bildfelder
 * - `previewDetail`: Vorschau der fertigen Detailseite
 * - `selectRelatedTestimonials`: Auswahl/Exclude von gefundenen Testimonials (für Dialograum-Ergebnis)
 */
export type CreationFlowStepPreset = 
  | 'welcome'
  | 'chooseSource'
  | 'collectSource' 
  | 'reviewMarkdown'
  | 'generateDraft' 
  | 'previewDetail'
  | 'publish'
  | 'editDraft'
  | 'uploadImages'
  | 'selectRelatedTestimonials'

/**
 * Optionaler Welcome-Step Inhalt (Markdown)
 *
 * - Wird im Wizard als erste Willkommensseite gerendert
 * - Bild kann optional als Data-URL direkt im Markdown eingebettet werden
 */
export interface TemplateCreationWelcomeConfig {
  /** Reiner Markdown-Inhalt der Willkommensseite */
  markdown: string
}

export type TemplatePreviewDetailViewType = 'book' | 'session' | 'testimonial' | 'blog' | 'climateAction'

export interface TemplateCreationPreviewConfig {
  /**
   * Welche Detailansicht im Preview-Step gerendert werden soll.
   * - `book`: BookDetail (klassische Dokumentansicht)
   * - `session`: SessionDetail (Event/Talk/Session Detail)
   */
  detailViewType: TemplatePreviewDetailViewType
}

export interface TemplateCreationOutputFileNameConfig {
  /**
   * Metadaten-Feld, dessen Wert als Dateiname verwendet wird.
   * Beispiel: "title" → "mein-titel.md"
   */
  metadataFieldKey?: string
  /**
   * Wenn true: Falls `metadataFieldKey` gesetzt ist, aber im Metadata leer ist,
   * wird es beim Speichern automatisch gefüllt (mit dem generierten Basename).
   */
  autoFillMetadataField?: boolean
  /** Dateiendung ohne Punkt (Default: "md") */
  extension?: string
  /** Fallback-Prefix, wenn kein Feldwert vorhanden ist (Default: typeId) */
  fallbackPrefix?: string
}

export interface TemplateCreationOutputConfig {
  /** Regeln für den Output-Dateinamen */
  fileName?: TemplateCreationOutputFileNameConfig
  /**
   * Wenn true: Source wird in einem eigenen Ordner gespeichert (Container-Modus).
   * Ordnername = Output-Dateiname ohne Extension (z.B. "mein-event").
   * Source-Datei heißt wie Ordner: "mein-event/mein-event.md".
   * Ermöglicht Child-Flows (z.B. Testimonials) im selben Ordner.
   */
  createInOwnFolder?: boolean
}

/**
 * Definition eines Bildfelds für den Creation-Wizard
 * Bilder werden beim Speichern nach Azure Blob Storage hochgeladen
 */
export interface TemplateCreationImageField {
  /** Metadaten-Feld-Key (z.B. 'coverImageUrl', 'image_url', 'testimonial_image_url') */
  key: string
  /** Optionales Label für die UI (falls nicht gesetzt, wird der key verwendet) */
  label?: string
  /** Optional: Erlaubt mehrere Bilder pro Feld (für zukünftige Erweiterungen) */
  multiple?: boolean
}

/**
 * UX-Creation-Flow-Konfiguration
 * 
 * Definiert, wie der Creation-Wizard für diesen Template-Typ aussehen soll.
 */

/**
 * Referenz auf einen Step-Preset im Creation-Flow
 */
export interface CreationFlowStepRef {
  /** Eindeutige ID dieses Steps */
  id: string
  /** Preset-ID (z.B. 'chooseSource', 'collectSource', 'briefing', 'editDraft') */
  preset: CreationFlowStepPreset
  /** Optionaler Titel für diesen Step */
  title?: string
  /** Optionaler Beschreibungstext für diesen Step */
  description?: string
  /** Optionale Liste von Feldnamen, die in diesem Step angezeigt werden sollen (nur für 'editDraft') */
  fields?: string[]
  /** 
   * Optionale Liste von Feldnamen, die als Bild-Upload gerendert werden sollen (nur für 'editDraft').
   * Diese Felder müssen auch in `fields` enthalten sein.
   * Beispiel: Wenn `fields: ['author_name', 'author_image_url']` und `imageFieldKeys: ['author_image_url']`,
   * dann wird `author_name` als Textfeld und `author_image_url` als Upload-Komponente gerendert.
   */
  imageFieldKeys?: string[]
}

/**
 * UX-Creation-Flow-Konfiguration
 * 
 * Definiert, wie der Creation-Wizard für diesen Template-Typ aussehen soll.
 */
export interface TemplateCreationConfig {
  /** Liste der unterstützten Input-Quellen */
  supportedSources: CreationSource[]
  /** Flow-Definition mit Steps */
  flow: {
    /** Liste der Steps in Reihenfolge */
    steps: CreationFlowStepRef[]
  }
  /**
   * Folge-Wizards (Orchestrierung) für Presets.
   *
   * Motivation:
   * - Diese Auswahl ist **Template/Preset-weit** (für Kommunikations-Designer),
   *   nicht pro erstelltem Dokument/Event.
   * - UI soll nur existierende Templates zulassen (Dropdown).
   *
   * Wird z.B. bei `docType: event` genutzt, um Flow B/C zu starten.
   */
  followWizards?: {
    /** Template-ID/Name für Flow B (Testimonial-Erfassung) */
    testimonialTemplateId?: string
    /** Template-ID/Name für Flow C (Final-Draft erzeugen) */
    finalizeTemplateId?: string
    /** Template-ID/Name für Flow C (Publish/Index-Swap) */
    publishTemplateId?: string
  }
  /** Optional: Willkommensseite (Markdown) */
  welcome?: TemplateCreationWelcomeConfig
  /** Optional: Preview-Konfiguration (Detailansicht-Typ) */
  preview?: TemplateCreationPreviewConfig
  /** Optional: Output-Konfiguration (z.B. Dateiname-Regeln) */
  output?: TemplateCreationOutputConfig
  /** Optional: UI-Metadaten für die Create-Seite */
  ui?: {
    /** Anzeigename auf der Create-Seite (falls nicht gesetzt, wird aus erstem Step oder Template-Name abgeleitet) */
    displayName?: string
    /** Beschreibung auf der Create-Seite (falls nicht gesetzt, wird aus erstem Step abgeleitet) */
    description?: string
    /** Icon-Name aus Lucide React (z.B. 'FileText', 'Calendar', 'MessageSquare') */
    icon?: string
  }
  /** 
   * @deprecated Bildfelder werden jetzt über den uploadImages Step definiert (fields).
   * Diese Eigenschaft bleibt für Rückwärtskompatibilität erhalten, wird aber nicht mehr verwendet.
   */
  imageFields?: TemplateCreationImageField[]
}

/**
 * Metadaten-Feld-Definition aus dem Frontmatter
 * 
 * Beispiel: `title: {{title|Full session title}}`
 */
export interface TemplateMetadataField {
  /** Feldname (z.B. 'title') */
  key: string
  /** Variable-Name (z.B. 'title') */
  variable: string
  /** Beschreibung/Hinweis (z.B. 'Full session title') */
  description: string
  /** Roher Wert aus dem Frontmatter */
  rawValue: string
}

/**
 * Template-Metadaten-Schema
 * 
 * Repräsentiert alle Felder aus dem Frontmatter.
 */
export interface TemplateMetadataSchema {
  /** Liste aller Metadaten-Felder */
  fields: TemplateMetadataField[]
  /** Roher Frontmatter-String */
  rawFrontmatter: string
  /** Optional: Detail-View-Type für die Anzeige transformierter Dokumente */
  detailViewType?: TemplatePreviewDetailViewType
}

/**
 * Parsed Template
 * 
 * Zentrale interne Repräsentation eines Templates nach dem Parsing.
 */
export interface ParsedTemplate {
  /** Template-Name (Dateiname ohne .md) */
  name: string
  /** Metadaten-Schema (Frontmatter) */
  metadata: TemplateMetadataSchema
  /** Systemprompt für LLM-Transformation */
  systemprompt: string
  /** Markdown Body (mit Platzhaltern) */
  markdownBody: string
  /** Optional: UX-Creation-Flow-Konfiguration */
  creation?: TemplateCreationConfig
  /** Roher Template-Content (für Debugging/Serialisierung) */
  rawContent?: string
}

/**
 * UX-Config View
 * 
 * Enthält nur die für den Creation-Wizard relevanten Daten.
 * Wird vom TemplateService bereitgestellt, wenn ein Template für UI-Zwecke verwendet wird.
 */
export interface UxConfig {
  /** Template-ID */
  templateId: string
  /** Creation-Flow-Konfiguration */
  creation: TemplateCreationConfig
  /** Liste der verfügbaren Metadaten-Felder (für Review-Step) */
  availableFields: string[]
}

/**
 * Prompt-Config View
 * 
 * Enthält nur die für LLM/Secretary relevanten Daten.
 * KEINE UX-spezifischen Informationen (kein creation-Block).
 * Wird vom TemplateService bereitgestellt, wenn ein Template für LLM-Aufrufe verwendet wird.
 */
export interface PromptConfig {
  /** Template-ID */
  templateId: string
  /** Metadaten-Schema (für Validierung/Strukturierung) */
  metadata: TemplateMetadataSchema
  /** Systemprompt */
  systemprompt: string
  /** Markdown Body (mit Platzhaltern) */
  markdownBody: string
}

/**
 * Validierungsfehler beim Parsen eines Templates
 */
export interface TemplateValidationError {
  /** Feld, in dem der Fehler auftritt */
  field: string
  /** Fehlermeldung */
  message: string
  /** Optional: Zeile im Template */
  line?: number
}

/**
 * MongoDB-Dokument für Template-Storage
 * 
 * Repräsentiert ein Template als JSON-Objekt in MongoDB.
 */
export interface TemplateDocument {
  /** Template-ID (z.B. "Session_analyze_en") */
  _id: string
  /** Template-Name */
  name: string
  /** Library-Zugehörigkeit */
  libraryId: string
  /** User-Email (Owner) */
  user: string
  
  /** Metadaten-Schema (Frontmatter als strukturiertes Objekt) */
  metadata: TemplateMetadataSchema
  /** Systemprompt für LLM-Transformation */
  systemprompt: string
  /** Markdown Body (mit Platzhaltern) */
  markdownBody: string
  /** Optional: UX-Creation-Flow-Konfiguration */
  creation?: TemplateCreationConfig
  
  /** Erstellungsdatum */
  createdAt: Date
  /** Aktualisierungsdatum */
  updatedAt: Date
  /** Version (für zukünftige Versionierung) */
  version: number
}

