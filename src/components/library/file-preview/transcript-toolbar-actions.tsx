'use client';

/**
 * file-preview/transcript-toolbar-actions.tsx
 *
 * Icon-only Toolbar im Transcript-Tab: Review/Vergleichen, optional Seiten
 * splitten (PDF), Neu generieren bzw. "Jetzt erstellen". Tooltips liefern
 * die frueheren Button-Texte.
 *
 * Aus `file-preview.tsx` extrahiert (Welle 3-II-a Phase 2a, Schritt 4b).
 */

import * as React from 'react'
import {
  ArrowLeft,
  Eye,
  Loader2,
  RefreshCw,
  Scissors,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

interface TranscriptToolbarActionsProps {
  isReviewMode: boolean
  onToggleReviewMode: () => void
  hasTranscriptItem: boolean
  /** Wie bisher: nur bestimmte Medientypen erhalten Split + Neu-generieren. */
  transcriptToolsEligible: boolean
  isPdf: boolean
  isSplittingPages: boolean
  setIsSplittingPages: React.Dispatch<React.SetStateAction<boolean>>
  isRunningPipeline: boolean
  hasActiveJob: boolean
  openPipelineForPhase: (phase: 'transcript', force?: boolean) => void
  activeLibraryId: string
  transcriptItem: StorageItem | null
  sourceItem: StorageItem
  provider: StorageProvider | null
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void
}

export function TranscriptToolbarActions({
  isReviewMode,
  onToggleReviewMode,
  hasTranscriptItem,
  transcriptToolsEligible,
  isPdf,
  isSplittingPages,
  setIsSplittingPages,
  isRunningPipeline,
  hasActiveJob,
  openPipelineForPhase,
  activeLibraryId,
  transcriptItem,
  sourceItem,
  provider,
  onRefreshFolder,
}: TranscriptToolbarActionsProps) {
  const runSplitPages = React.useCallback(async () => {
    if (!activeLibraryId || !transcriptItem?.id) return
    setIsSplittingPages(true)
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/markdown/split-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFileId: transcriptItem.id,
          originalFileId: sourceItem.id,
          targetLanguage: 'de',
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: unknown; folderName?: string; created?: number }
      if (!res.ok) {
        const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
        throw new Error(msg)
      }
      toast.success('Seiten gesplittet', {
        description: `${json.created ?? 0} Seiten in Ordner "${json.folderName || 'pages'}" gespeichert.`,
      })
      if (onRefreshFolder && sourceItem.parentId) {
        const refreshed = await provider?.listItemsById(sourceItem.parentId)
        if (refreshed) onRefreshFolder(sourceItem.parentId, refreshed)
      }
    } catch (error) {
      toast.error('Split fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      })
    } finally {
      setIsSplittingPages(false)
    }
  }, [
    activeLibraryId,
    transcriptItem?.id,
    sourceItem.id,
    sourceItem.parentId,
    provider,
    onRefreshFolder,
    setIsSplittingPages,
  ])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={isReviewMode ? 'secondary' : 'outline'}
              className="h-8 w-8"
              onClick={onToggleReviewMode}
              aria-label={isReviewMode ? 'Zur Listenansicht' : 'Vergleichen'}
            >
              {isReviewMode ? <ArrowLeft className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isReviewMode
              ? 'Zur Listenansicht (Review beenden)'
              : 'Vergleichen: eine Vorschau, im Transcript-Tab Original links und Text rechts'}
          </TooltipContent>
        </Tooltip>

        {!hasTranscriptItem ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="default"
                className="h-8 w-8"
                onClick={() => openPipelineForPhase('transcript')}
                disabled={isRunningPipeline || hasActiveJob}
                aria-label="Transkript jetzt erstellen"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Transkript jetzt erstellen</TooltipContent>
          </Tooltip>
        ) : transcriptToolsEligible ? (
          <>
            {isPdf ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={isSplittingPages || !provider}
                    onClick={() => void runSplitPages()}
                    aria-label="Seiten splitten"
                  >
                    {isSplittingPages ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Scissors className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Seiten splitten</TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => openPipelineForPhase('transcript', true)}
                  disabled={isRunningPipeline || hasActiveJob}
                  aria-label="Transkript neu generieren"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Transkript neu generieren</TooltipContent>
            </Tooltip>
          </>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
