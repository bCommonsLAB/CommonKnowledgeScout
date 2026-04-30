/**
 * file-preview/views/view-props.ts
 *
 * Gemeinsames Props-Interface fuer alle View-Typ-Komponenten unter
 * `file-preview/views/`. Aus dem Composer (`PreviewContent` in
 * `file-preview.tsx`) als Bundle weitergereicht, damit jede View
 * den State + Handlers ohne 40-Property-Boilerplate konsumieren kann.
 *
 * Welle 3-II-a Phase 2a (audio + image) — siehe
 * `welle-3-archiv-detail-contracts.mdc` §6a.
 *
 * Spaetere Views (video, markdown, pdf, office, presentation, website,
 * default) erhalten ggf. zusaetzliche Props ueber Discriminated Unions
 * oder eigene Erweiterungs-Interfaces; das Basis-Bundle bleibt aber
 * stabil.
 */

import type * as React from 'react'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { ClientLibrary } from '@/types/library'
import type { FrontendShadowTwinState } from '@/atoms/shadow-twin-atom'
import type { StoryStepStatus } from '@/components/library/shared/story-status'
import type { LlmModelOption, PipelinePolicies, CoverImageOptions } from '@/components/library/flow/pipeline-sheet'
import type { ResolvedTranscriptItemResult } from '@/components/library/shared/use-resolved-transcript-item'
import type { CompositeWikiPreviewOptions } from '@/components/library/markdown-preview'

/** Tab-Identitaet (siehe `PreviewContent.infoTab`-State). */
export type PreviewInfoTab = 'original' | 'transcript' | 'transform' | 'story' | 'overview'

/** Pipeline-Phasen-Trigger fuer "Jetzt erstellen"/"Neu generieren"/"Erneut publizieren". */
export type PreviewPipelinePhase = 'transcript' | 'transform' | 'story'

/** Aktueller Job-Status (vereinfacht — ohne `phase` etc.). */
export interface PreviewJobInfo {
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress?: number
  message?: string
  phase?: string
}

/**
 * Gemeinsame Props, die alle View-Komponenten unter
 * `file-preview/views/` benoetigen. Wird vom Composer einmal
 * zusammengebaut und per Spread `<View {...viewProps} />` in jede
 * View-Komponente gereicht.
 *
 * Wichtig: Dieses Interface ist absichtlich gross — die View-Komponenten
 * haben eigene Closure ueber den Composer-State, und um Boilerplate zu
 * vermeiden, wird das gesamte Bundle weitergereicht. Tests muessen
 * NICHT alle Felder befuellen; ein Mock-Generator (`makeMockViewProps`
 * in den Tests) liefert sinnvolle Defaults.
 */
export interface PreviewViewProps {
  // Datei + Provider + Library
  item: StorageItem
  provider: StorageProvider | null
  activeLibraryId: string
  activeLibrary: ClientLibrary | undefined
  fileType: string
  kind: string

  // Tab-State
  infoTab: PreviewInfoTab
  setInfoTab: React.Dispatch<React.SetStateAction<PreviewInfoTab>>

  // Shadow-Twin + Story-Steps
  shadowTwinState: FrontendShadowTwinState | undefined
  storySteps: StoryStepStatus[]

  // Transcript-Auswahl
  transcript: ResolvedTranscriptItemResult
  displayTranscriptItem: StorageItem | null
  transcriptHeaderExtra: React.ReactNode

  // Transformation-Auswahl
  transformItem: StorageItem | null
  transformError: string | null
  transformHeaderExtra: React.ReactNode

  // Job-Status + Pipeline-Trigger
  hasActiveJob: boolean
  currentJobInfo?: PreviewJobInfo
  isRunningPipeline: boolean
  openPipelineForPhase: (phase: PreviewPipelinePhase, force?: boolean) => void
  effectiveMdIdRef?: React.MutableRefObject<string | null>

  // Review-Modus
  isReviewMode: boolean
  handleReviewModeToggle: () => void
  isSplittingPages: boolean
  setIsSplittingPages: React.Dispatch<React.SetStateAction<boolean>>

  // Refresh
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void

  // PipelineSheet-State
  isPipelineOpen: boolean
  setIsPipelineOpen: React.Dispatch<React.SetStateAction<boolean>>
  effectiveTargetLanguage: string
  setTargetLanguage: React.Dispatch<React.SetStateAction<string>>
  sourceLanguage: string
  setSourceLanguage: React.Dispatch<React.SetStateAction<string>>
  templateName: string
  setTemplateName: React.Dispatch<React.SetStateAction<string>>
  templates: string[]
  isLoadingTemplates: boolean
  llmModel: string
  setLlmModel: React.Dispatch<React.SetStateAction<string>>
  llmModels: LlmModelOption[]
  isLoadingLlmModels: boolean
  runPipeline: (args: {
    templateName?: string
    targetLanguage: string
    sourceLanguage?: string
    policies: PipelinePolicies
    coverImage?: CoverImageOptions
    llmModel?: string
    customHint?: string
  }) => Promise<void>
  pipelineDefaultSteps: { extract: boolean; metadata: boolean; ingest: boolean } | undefined
  pipelineDefaultForce: boolean
  savedCustomHint: string

  // ---------------------------------------------------------------------
  // Markdown-/Website-View-spezifische Felder (Welle 3-II-a Phase 2d).
  //
  // Diese Felder werden NUR von markdown-view.tsx und website-view.tsx
  // benoetigt. Damit Audio/Image/Video/PDF/Office Views nicht extra
  // Mock-Daten brauchen, sind sie als optional deklariert.
  //
  // Composer (PreviewContent) MUSS sie aber immer setzen — die Views,
  // die sie brauchen, lesen sie ueber Type-Guards (oder erwarten sie
  // einfach, da sie im Composer immer existieren).
  // ---------------------------------------------------------------------

  /** Original-Datei-Inhalt als String (fuer markdown + website noetig). */
  content?: string
  /** Folder-ID zum Aufloesen relativer Wiki-Links im MarkdownPreview. */
  currentFolderId?: string
  /** Composite-Wiki-Preview-Konfiguration (Sammel-Markdown). */
  compositeWikiPreview?: CompositeWikiPreviewOptions | null

  /** State + Setter fuer den Markdown-Edit-Dialog. */
  isEditOpen?: boolean
  setIsEditOpen?: React.Dispatch<React.SetStateAction<boolean>>

  /** Content-Cache-Ref (mutiert nach erfolgreichem Save). */
  contentCache?: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>
  /** Callback nach Inhalts-Update (informiert FilePreview-Reducer). */
  onContentUpdated?: (content: string) => void
  /** Setter fuer das selectedFile-Atom (wird nach Edit/Save aktualisiert). */
  setSelectedFile?: (item: StorageItem) => void
}
