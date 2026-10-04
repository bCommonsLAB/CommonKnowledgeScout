'use client'

/**
 * Die App-Stuecke unter Antwort und Themenuebersicht im Story-Modus (D6c):
 * KI-Hinweis, Konfig-Anzeige, Protokoll und Debug fuer Angemeldete. Die
 * Quellen-Knoepfe unten sind seit D12r weg: Die Quellen stehen rechts als
 * Leiste, auf dem Telefon oben in der Story-Zeile. Kommen als Slots `antwortFuss` und
 * `uebersichtFuss` in `StoryRoot` — das Paket kennt sie nicht.
 */

import { useState } from 'react'
import { Bug, FileText } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@ks/ui'
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
  return (
    <div className="space-y-4" data-story-uebersicht-fuss>
      <AIGeneratedNotice compact variant="uebersicht" />
      {queryId && (
        <div className="border-t border-border/50 pt-4">
          <ChatConfigDisplay libraryId={libraryId} queryId={queryId} llmModel={llmModel} />
        </div>
      )}
    </div>
  )
}
