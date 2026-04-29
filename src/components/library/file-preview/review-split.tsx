'use client';

/**
 * file-preview/review-split.tsx
 *
 * Komponenten fuer den Review-Modus der File-Preview:
 * - `ReviewOriginalPane` — Linker Pane mit Original-Quelle (PDF/Audio/Video/Office)
 * - `WebsiteReviewOriginalIframe` — Iframe-Variante fuer URL-Dateien
 * - `ReviewTranscriptSplit` — Resizable Split: Original | Transcript
 * - `wrapTranscriptTabWithReviewSplit` — Util, das den Transcript-Panel
 *   mit oder ohne Review-Split rendert
 *
 * Aus `file-preview.tsx` extrahiert (Welle 3-II-a).
 */

import * as React from 'react'
import { ExternalLink } from 'lucide-react'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { SourceRenderer } from '@/components/library/flow/source-renderer'

/** Nur die Quelle (PDF/Audio/Video/Office), ohne das untere Transkript aus SourceAndTranscriptPane. */
export function ReviewOriginalPane(props: {
  provider: StorageProvider
  item: StorageItem
  streamingUrl?: string | null
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border bg-background">
      <div className="shrink-0 border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground truncate">
        {props.item.metadata?.name ?? ''}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SourceRenderer
          provider={props.provider}
          file={props.item}
          streamingUrl={props.streamingUrl ?? null}
          showHeader={false}
        />
      </div>
    </div>
  )
}

/** .url-Original wie im Tab "Original" (Iframe), fuer Review-Split links. */
export function WebsiteReviewOriginalIframe(props: { urlContent: string | undefined; label: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border bg-background">
      {props.urlContent ? (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-4 py-3">
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            <a
              href={props.urlContent}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm text-primary hover:underline"
            >
              {props.urlContent}
            </a>
          </div>
          <div className="relative min-h-0 flex-1">
            <iframe
              src={props.urlContent}
              title={props.label}
              className="absolute inset-0 h-full w-full"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
            <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center text-sm text-muted-foreground">
              <p>Website blockiert moeglicherweise die Einbettung.</p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Keine gueltige URL gefunden.
        </div>
      )}
    </div>
  )
}

/** Resizable Split: Original (links) und Transcript (rechts). */
export function ReviewTranscriptSplit(props: { original: React.ReactNode; transcript: React.ReactNode }) {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-[200px] w-full">
      <ResizablePanel defaultSize={50} minSize={24} className="min-h-0 overflow-hidden">
        <div className="h-full min-h-0 pr-2">{props.original}</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={28} className="min-h-0 overflow-hidden">
        <div className="h-full min-h-0 overflow-hidden pl-2">{props.transcript}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

/**
 * Review-Modus: im Transcript-Tab Original links, Artefakt rechts —
 * eine Tab-Leiste, keine zweite FilePreview.
 */
export function wrapTranscriptTabWithReviewSplit(
  isReviewMode: boolean,
  originalPane: React.ReactNode,
  transcriptPanel: React.ReactNode,
) {
  if (!isReviewMode) {
    return <div className="h-full overflow-hidden rounded border p-3">{transcriptPanel}</div>
  }
  return (
    <ReviewTranscriptSplit
      original={originalPane}
      transcript={
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border p-3">{transcriptPanel}</div>
      }
    />
  )
}
