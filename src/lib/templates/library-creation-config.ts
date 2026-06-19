/**
 * @fileoverview Library Creation-Konfiguration
 * 
 * @description
 * Hilfsfunktionen zum Laden und Validieren der Creation-Konfiguration.
 * Creation-Typen werden aus MongoDB-Templates abgeleitet und mit Built-in-Templates gemergt.
 */

import type { ParsedTemplate, TemplateDocument } from './template-types'
import { listBuiltinCreationTemplates } from '@/lib/templates/builtin-creation-templates'
import { isWizardFlowDoc } from '@/lib/creation/wizard-flow-entity'
import {
  curateCreationTypes,
  buildStandardWizardCreationType,
  type CaptureWizardsConfig,
} from '@/lib/creation/capture-wizards'

/**
 * Creation-Typ-Definition aus Template
 */
export interface LibraryCreationType {
  id: string
  label: string
  description: string
  templateId: string
  icon?: string
  /** Herkunft: Library-Mongo oder eingebautes Standard-Template */
  source?: 'library' | 'builtin'
  /** Optional: Built-ins können als schreibgeschützte Vorlage markiert werden (UI) */
  isReadonly?: boolean
  /** Noch nicht nutzbar: Karte sichtbar, aber ausgegraut (z. B. bis Pipeline stabil ist) */
  disabled?: boolean
  /** Kurzer Hinweis unter der Beschreibung, wenn disabled */
  disabledHint?: string
}

/**
 * Leitet einen Anzeigenamen aus dem Template-Namen ab.
 * 
 * Beispiele:
 * - "Session_analyze_en" → "Session"
 * - "Event_Create" → "Event"
 * - "testimonial_template" → "Testimonial"
 */
function deriveDisplayNameFromTemplateName(templateName: string): string {
  // Entferne Suffixe wie "_analyze_en", "_template", "_create"
  const name = templateName
    .replace(/_(analyze|template|create|en|de)$/i, '')
    .replace(/_/g, ' ')
  
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * Leitet ein Icon aus dem Template-Namen ab.
 * 
 * Beispiele:
 * - "Session_*" → "FileText"
 * - "Event_*" → "Calendar"
 * - "Testimonial_*" → "MessageSquare"
 * - "Job_*" → "Briefcase"
 */
function deriveIconFromTemplateName(templateName: string): string | undefined {
  const lowerName = templateName.toLowerCase()
  
  // Pattern-Matching für bekannte Typen
  if (lowerName.includes('session') || lowerName.includes('talk') || lowerName.includes('presentation')) {
    return 'FileText'
  }
  if (lowerName.includes('event') || lowerName.includes('conference') || lowerName.includes('meeting')) {
    return 'Calendar'
  }
  if (lowerName.includes('testimonial') || lowerName.includes('review') || lowerName.includes('quote')) {
    return 'MessageSquare'
  }
  if (lowerName.includes('job') || lowerName.includes('position') || lowerName.includes('career')) {
    return 'Briefcase'
  }
  if (lowerName.includes('book') || lowerName.includes('article') || lowerName.includes('document')) {
    return 'BookOpen'
  }
  
  // Default: FileText
  return 'FileText'
}

/**
 * Mappt ein Template-Dokument auf einen Creation-Typ (ohne Netzwerk).
 * Dient Tests und Merge-Logik.
 */
export function templateDocumentToCreationType(
  template: TemplateDocument,
  source: 'library' | 'builtin'
): LibraryCreationType | null {
  // W-A/Δ1: Eine herausgeloeste Wizard-Flow-Entitaet (`kind:'wizard'`) ist KEIN
  // Schema-Inhaltstyp und gehoert nicht in die Inhaltstyp-Ableitung.
  if (isWizardFlowDoc(template)) {
    return null
  }
  if (
    !template.creation ||
    template.creation.supportedSources.length === 0 ||
    template.creation.flow.steps.length === 0
  ) {
    return null
  }
  const templateName = template.name
  const creation = template.creation
  const firstStep = creation.flow.steps[0]

  const displayName =
    creation.ui?.displayName || firstStep?.title || deriveDisplayNameFromTemplateName(templateName)
  const description =
    creation.ui?.description ||
    firstStep?.description ||
    `Erstelle ${displayName} mit diesem Template`
  // Diktat: immer Mikrofon (Lucide „Mic“), nicht die Default-Ableitung „FileText“ vom Namen audio-transcript-de.
  const icon =
    templateName === 'audio-transcript-de'
      ? 'Mic'
      : creation.ui?.icon || deriveIconFromTemplateName(templateName)

  // U6c: Der separate pdfanalyse-HITL-Flow schrieb direkt ins Archiv (Shadow-Twin)
  // und ist stillgelegt — PDFs laufen jetzt über „Inhalte erfassen" (generischer
  // Wizard, off-target in den Wartekorb). Karte bleibt sichtbar, Start gesperrt;
  // der tote HITL-Code wird in U6e entfernt.
  const isPdfAnalyse = templateName.toLowerCase() === 'pdfanalyse'

  return {
    id: templateName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    label: displayName,
    description,
    templateId: templateName,
    icon,
    source,
    isReadonly: source === 'builtin',
    disabled: isPdfAnalyse,
    disabledHint: isPdfAnalyse
      ? 'Bitte „Inhalte erfassen" nutzen — PDFs werden dort analysiert und landen im Wartekorb.'
      : undefined,
  }
}

/**
 * Merge: MongoDB-Templates zuerst; Built-ins nur wenn kein gleichnamiges Library-Template existiert.
 *
 * @param libraryId aktuelle Library (für Built-in-Platzhalter)
 * @param userEmail Owner-String für Built-in-Dokumente (nur Metadaten)
 */
export function mergeCreationTypesWithBuiltins(
  mongoTemplates: TemplateDocument[],
  libraryId: string,
  userEmail: string
): LibraryCreationType[] {
  const fromMongo: LibraryCreationType[] = mongoTemplates
    .map((t) => templateDocumentToCreationType(t, 'library'))
    .filter((x): x is LibraryCreationType => x !== null)

  const mongoNames = new Set(fromMongo.map((t) => t.templateId))

  const builtins = listBuiltinCreationTemplates(libraryId, userEmail)
  const fromBuiltin: LibraryCreationType[] = []
  for (const b of builtins) {
    if (mongoNames.has(b.name)) continue
    const row = templateDocumentToCreationType(b, 'builtin')
    if (row) fromBuiltin.push(row)
  }

  // W-D: Der generische Standard-Wizard ist immer waehlbar (eigene Karte, NICHT
  // ueber templateDocumentToCreationType, da Flow-Entitaeten dort uebersprungen
  // werden). Lauffaehig via getBuiltinCreationTemplate(STANDARD_CAPTURE_FLOW_ID).
  const merged = [...fromMongo, ...fromBuiltin]
  const standard = buildStandardWizardCreationType()
  if (!merged.some((t) => t.id === standard.id)) merged.push(standard)
  return merged
}

/**
 * Lädt die Creation-Typen aus MongoDB-Templates und ergänzt Built-in-Standardvorlagen.
 *
 * W-B: Ist `captureWizards` gesetzt, wird die Liste KURATIERT (Auswahl +
 * Reihenfolge, Entscheidung #3). Ohne Config bleibt das Bestandsverhalten
 * (alle Templates mit `creation`-Block) — der „nur Standard-Wizard"-Default
 * wird erst mit W-C aktiviert (das das Config-Feld + die Settings-UI liefert).
 *
 * @param libraryId Library-ID
 * @param captureWizards Optionale Kuratierungs-Config der Library
 * @returns Array von Creation-Typen
 */
export async function getLibraryCreationConfig(
  libraryId: string,
  captureWizards?: CaptureWizardsConfig
): Promise<LibraryCreationType[]> {
  try {
    // Lade alle Templates der Library
    const response = await fetch(`/api/templates?libraryId=${encodeURIComponent(libraryId)}`)
    let templates: TemplateDocument[] = []
    if (!response.ok) {
      console.error('[getLibraryCreationConfig] Fehler beim Laden der Templates:', response.status)
      // Trotzdem Built-ins anzeigen (neue Library / API kurz nicht erreichbar).
    } else {
      const data = await response.json()
      templates = data.templates || []
    }

    // Platzhalter-Owner nur für Listen-Merge; echte User-Mail liefert die Config-API beim Template-Laden.
    const merged = mergeCreationTypesWithBuiltins(templates, libraryId, 'builtin@local')
    if (!captureWizards) return merged
    return curateCreationTypes(merged, captureWizards, {
      standardWizard: buildStandardWizardCreationType(),
    })
  } catch (error) {
    console.error('[getLibraryCreationConfig] Fehler:', error)
    return []
  }
}

/**
 * Validiert, ob ein Template für einen Creation-Typ verwendet werden kann
 * (Template muss einen creation-Block haben)
 */
export function isTemplateCreationReady(template: ParsedTemplate | TemplateDocument): boolean {
  return !!template.creation && 
         template.creation.supportedSources.length > 0 &&
         template.creation.flow.steps.length > 0
}

/**
 * Findet einen Creation-Typ in den Templates einer Library
 */
export async function findCreationType(
  libraryId: string,
  typeId: string
): Promise<LibraryCreationType | undefined> {
  const types = await getLibraryCreationConfig(libraryId)
  return types.find(t => t.id === typeId)
}

/**
 * Validiert eine Creation-Typ-Konfiguration
 */
export function validateCreationType(type: LibraryCreationType): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!type.id || type.id.trim().length === 0) {
    errors.push('ID ist erforderlich')
  }
  
  if (!type.label || type.label.trim().length === 0) {
    errors.push('Label ist erforderlich')
  }
  
  if (!type.templateId || type.templateId.trim().length === 0) {
    errors.push('Template-ID ist erforderlich')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Lädt ein Template-Dokument für einen Creation-Typ
 * 
 * @param libraryId Library-ID
 * @param typeId Creation-Typ-ID
 * @returns TemplateDocument oder null wenn nicht gefunden
 */
export async function loadCreationTypeTemplate(
  libraryId: string,
  typeId: string
): Promise<TemplateDocument | null> {
  try {
    const creationType = await findCreationType(libraryId, typeId)
    if (!creationType) {
      return null
    }
    
    // Lade Template-Config über API
    const response = await fetch(
      `/api/templates/${encodeURIComponent(creationType.templateId)}/config?libraryId=${encodeURIComponent(libraryId)}`
    )
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.template || null
  } catch (error) {
    console.error('[loadCreationTypeTemplate] Fehler:', error)
    return null
  }
}

