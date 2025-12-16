import { atom } from "jotai"
import type { TemplateMetadataSchema, TemplateCreationConfig } from "@/lib/templates/template-types"

// Template-Struktur (basierend auf TemplateDocument, aber ohne MongoDB-spezifische Felder)
export interface Template {
  _id: string
  name: string
  libraryId: string
  user: string
  metadata: TemplateMetadataSchema
  systemprompt: string
  markdownBody: string
  creation?: TemplateCreationConfig | null
  createdAt?: Date | string
  updatedAt?: Date | string
  version?: number
  // Legacy-Felder für Kompatibilität (werden aus metadata generiert)
  lastModified?: string
  fileId?: string
}

// Template-State
export interface TemplateState {
  templates: Template[]
  selectedTemplateName: string | null
  templatesFolderId: string | null
  isLoading: boolean
  error: string | null
}

// Initialer State
const initialState: TemplateState = {
  templates: [],
  selectedTemplateName: null,
  templatesFolderId: null,
  isLoading: false,
  error: null
}

// Hauptatom für Template-State
export const templateAtom = atom<TemplateState>(initialState)
templateAtom.debugLabel = "templateAtom"

// Derivierte Atome
export const templatesAtom = atom(
  get => get(templateAtom).templates,
  (get, set, newTemplates: Template[]) => {
    set(templateAtom, {
      ...get(templateAtom),
      templates: newTemplates
    })
  }
)
templatesAtom.debugLabel = "templatesAtom"

export const selectedTemplateNameAtom = atom(
  get => get(templateAtom).selectedTemplateName,
  (get, set, newTemplateName: string | null) => {
    set(templateAtom, {
      ...get(templateAtom),
      selectedTemplateName: newTemplateName
    })
  }
)
selectedTemplateNameAtom.debugLabel = "selectedTemplateNameAtom"

export const selectedTemplateAtom = atom(
  get => {
    const state = get(templateAtom)
    return state.templates.find(t => t.name === state.selectedTemplateName) || null
  }
)
selectedTemplateAtom.debugLabel = "selectedTemplateAtom"

export const templatesFolderIdAtom = atom(
  get => get(templateAtom).templatesFolderId,
  (get, set, newFolderId: string | null) => {
    set(templateAtom, {
      ...get(templateAtom),
      templatesFolderId: newFolderId
    })
  }
)
templatesFolderIdAtom.debugLabel = "templatesFolderIdAtom"

export const templateLoadingAtom = atom(
  get => get(templateAtom).isLoading,
  (get, set, isLoading: boolean) => {
    set(templateAtom, {
      ...get(templateAtom),
      isLoading
    })
  }
)
templateLoadingAtom.debugLabel = "templateLoadingAtom"

export const templateErrorAtom = atom(
  get => get(templateAtom).error,
  (get, set, error: string | null) => {
    set(templateAtom, {
      ...get(templateAtom),
      error
    })
  }
)
templateErrorAtom.debugLabel = "templateErrorAtom"

// Template Ready Status (wenn Templates geladen sind)
export const templatesReadyAtom = atom(
  get => {
    const state = get(templateAtom)
    return !state.isLoading && state.templatesFolderId !== null
  }
)
templatesReadyAtom.debugLabel = "templatesReadyAtom" 