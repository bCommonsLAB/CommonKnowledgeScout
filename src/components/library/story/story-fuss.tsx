'use client'

/**
 * Die App-Stuecke unter Antwort und Themenuebersicht im Story-Modus (D6c):
 * KI-Hinweis, Konfig-Anzeige, Quellenverzeichnis (Mobil-Sheet der Galerie),
 * Protokoll und Debug fuer Angemeldete. Kommen als Slots `antwortFuss` und
 * `uebersichtFuss` in `StoryRoot` — das Paket kennt sie nicht.
 */

import { useState } from 'react'
import { BookOpen, Bug, FileText } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { Nachricht } from '@ks/module-story/react'
import { AIGeneratedNotice } from '@/components/shared/ai-generated-notice'
import { ChatConfigDisplay } from '@/components/library/chat/chat-config-display'
import { QueryDetailsDialog } from '@/components/library/chat/query-details-dialog'
import { ProcessingLogsDialog } from '@/components/library/chat/processing-logs-dialog'

export interface StoryAntwortFussProps {
  libraryId: string
  antwort: Nachricht
  llmModel: string
}

export function StoryAntwortFuss({ libraryId, antwort, llmModel }: StoryAntwortFussProps) {
  const { t } = useTranslation()
  const { isSignedIn } = useUser()
  const [details, setDetails] = useState(false)
  const [protokoll, setProtokoll] = useState(false)
  const queryId = antwort.queryId
  const belege = antwort.belege ?? []

  return (
    <div className="mt-3 space-y-3" data-story-antwort-fuss>
      <AIGeneratedNotice sources={belege.map((b) => ({ id: b.fileId || String(b.number), fileName: b.fileName }))} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {queryId && (
          <div className="min-w-[200px] flex-1">
            <ChatConfigDisplay libraryId={libraryId} queryId={queryId} llmModel={llmModel} />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Quellenverzeichnis — oeffnet das Sheet der Galerie (mobil; am Desktop stehen die Belege rechts). */}
          {belege.length > 0 && (
            <Button
              variant="default"
              size="sm"
              className="h-9 gap-2 px-4 font-medium lg:hidden"
              onClick={() => window.dispatchEvent(new CustomEvent('show-reference-legend', { detail: { references: belege, libraryId, queryId } }))}
            >
              <BookOpen className="h-4 w-4" />
              {t('gallery.references')}
            </Button>
          )}
          {queryId && isSignedIn && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setProtokoll(true)} className="h-6 text-xs text-muted-foreground hover:text-foreground" title="Zeigt die Verarbeitungsschritte dieser Antwort">
                <FileText className="mr-1 h-3 w-3" />
                Logs
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDetails(true)} className="h-6 text-xs text-muted-foreground hover:text-foreground" title="Zeigt technische Debug-Informationen zur Query">
                <Bug className="mr-1 h-3 w-3" />
                Debug
              </Button>
            </>
          )}
        </div>
      </div>
      {queryId && <QueryDetailsDialog open={details} onOpenChange={setDetails} libraryId={libraryId} queryId={queryId} />}
      {queryId && isSignedIn && <ProcessingLogsDialog open={protokoll} onOpenChange={setProtokoll} libraryId={libraryId} queryId={queryId} />}
    </div>
  )
}

export interface StoryUebersichtFussProps {
  libraryId: string
  queryId: string | null
  llmModel: string
}

export function StoryUebersichtFuss({ libraryId, queryId, llmModel }: StoryUebersichtFussProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4" data-story-uebersicht-fuss>
      <AIGeneratedNotice compact variant="uebersicht" />
      {queryId && (
        <div className="border-t border-border/50 pt-4">
          <ChatConfigDisplay libraryId={libraryId} queryId={queryId} llmModel={llmModel} />
        </div>
      )}
      {/* Quellenverzeichnis der Uebersicht — nur auf Mobil, die Spalte rechts gibt es dort nicht. */}
      <div className="lg:hidden">
        <Button variant="default" size="sm" className="w-full gap-2" onClick={() => window.dispatchEvent(new CustomEvent('show-toc-references', { detail: { libraryId } }))}>
          <BookOpen className="h-4 w-4" />
          {t('gallery.tocReferences')}
        </Button>
      </div>
    </div>
  )
}
