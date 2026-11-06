'use client'

/**
 * Dezenter Aufklapper „Verarbeitung ansehen" am Fuss einer fertigen Antwort
 * (Welle N5). Holt beim ersten Oeffnen die Verarbeitungsschritte der Query
 * (`processingLogs`, wie der fruehere Logs-Knopf) und zeigt sie mit der
 * FREUNDLICHEN Darstellung `VerarbeitungEinfach` — dieselbe wie waehrend der
 * Berechnung, ohne die technische Debug-Flut. Ersetzt auf der Website den
 * entfernten Logs-Dialog.
 */

import { useCallback, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { VerarbeitungEinfach } from '@ks/module-story/react'
import { useTranslation } from '@ks/i18n/react'
import type { ChatProcessingStep } from '@/types/chat-processing'

export interface StoryVerarbeitungAufklapperProps {
  libraryId: string
  queryId: string
}

export function StoryVerarbeitungAufklapper({ libraryId, queryId }: StoryVerarbeitungAufklapperProps) {
  const { t } = useTranslation()
  const [offen, setOffen] = useState(false)
  const [laedt, setLaedt] = useState(false)
  // null = noch nicht geladen; [] = geladen, aber keine Schritte.
  const [schritte, setSchritte] = useState<ChatProcessingStep[] | null>(null)

  const laden = useCallback(async () => {
    setLaedt(true)
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { processingLogs?: ChatProcessingStep[] }
      setSchritte(Array.isArray(data.processingLogs) ? data.processingLogs : [])
    } catch {
      setSchritte([])
    } finally {
      setLaedt(false)
    }
  }, [libraryId, queryId])

  const umschalten = () => {
    const naechste = !offen
    setOffen(naechste)
    if (naechste && schritte === null && !laedt) void laden()
  }

  return (
    <div className="mt-1" data-story-verarbeitung>
      <button
        type="button"
        aria-expanded={offen}
        onClick={umschalten}
        className="inline-flex items-center gap-1 text-xs text-neutral-500 transition-colors hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${offen ? 'rotate-180' : ''}`} aria-hidden="true" />
        {t('website.story.verarbeitungAnsehen')}
      </button>
      {offen && (
        <div className="mt-2">
          {laedt && (
            <span className="inline-flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            </span>
          )}
          {!laedt && schritte && schritte.length > 0 && <VerarbeitungEinfach schritte={schritte} />}
          {!laedt && schritte && schritte.length === 0 && <p className="text-xs text-neutral-500">{t('website.story.verarbeitungLeer')}</p>}
        </div>
      )}
    </div>
  )
}
