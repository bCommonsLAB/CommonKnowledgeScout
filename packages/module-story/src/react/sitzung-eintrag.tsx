'use client'

/**
 * Eine Sitzung in „Meine Fragen": Titel (umbenennbar), aufklappbar, darunter
 * die Fragen chronologisch als Kurztitel. Klick auf eine Frage waehlt die
 * Konversation; Klick auf den Titel macht die Sitzung aktiv (fortsetzen).
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Pencil } from 'lucide-react'
import { Button, Input } from '@ks/ui'
import { cn } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import { kurztitelFuer } from './kurztitel'
import type { ChronikFrage, ChronikSitzung, StoryAuswahl } from './types'

export interface SitzungEintragProps {
  sitzung: ChronikSitzung
  istAktiv: boolean
  offen: boolean
  auswahl: StoryAuswahl
  onOeffnen: (chatId: string, offen: boolean) => void
  onFrageWaehlen: (chatId: string, frage: ChronikFrage) => void
  onUmbenennen: (chatId: string, titel: string) => Promise<void>
  /** `false` fuer die vorlaeufige Sitzung (D2): Sie hat auf dem Server noch keinen Titel. */
  umbenennbar?: boolean
}

function istGewaehlt(auswahl: StoryAuswahl, frage: ChronikFrage): boolean {
  if (auswahl.art !== 'konversation') return false
  if (auswahl.queryId && frage.queryId) return auswahl.queryId === frage.queryId
  return Boolean(auswahl.frageId && frage.frageId && auswahl.frageId === frage.frageId)
}

export function SitzungEintrag({
  sitzung,
  istAktiv,
  offen,
  auswahl,
  onOeffnen,
  onFrageWaehlen,
  onUmbenennen,
  umbenennbar = true,
}: SitzungEintragProps) {
  const { t } = useTranslation()
  const [bearbeiten, setBearbeiten] = useState(false)
  const [entwurf, setEntwurf] = useState(sitzung.titel)
  const [fehler, setFehler] = useState<string | null>(null)
  const Pfeil = offen ? ChevronDown : ChevronRight

  async function speichern() {
    try {
      await onUmbenennen(sitzung.chatId, entwurf)
      setFehler(null)
      setBearbeiten(false)
    } catch (e) {
      setFehler(t('story.renameError', { error: e instanceof Error ? e.message : String(e) }))
    }
  }

  return (
    <li className="group">
      <div className={cn('flex items-center gap-1 rounded-md px-1 py-1', istAktiv && 'bg-muted')}>
        <button
          type="button"
          onClick={() => onOeffnen(sitzung.chatId, !offen)}
          aria-expanded={offen}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm hover:text-foreground"
          title={sitzung.titel}
        >
          <Pfeil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {bearbeiten ? (
            <Input
              autoFocus
              value={entwurf}
              onChange={(e) => setEntwurf(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => void speichern()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void speichern()
                if (e.key === 'Escape') {
                  setEntwurf(sitzung.titel)
                  setBearbeiten(false)
                }
              }}
              className="h-7 text-sm"
              aria-label={t('story.renameSession')}
            />
          ) : (
            <span className={cn('truncate', istAktiv ? 'font-medium' : 'text-muted-foreground')}>{sitzung.titel}</span>
          )}
        </button>
        {umbenennbar && !bearbeiten && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
            onClick={() => {
              setEntwurf(sitzung.titel)
              setBearbeiten(true)
            }}
            aria-label={t('story.renameSession')}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
      {fehler && <p className="px-2 text-xs text-destructive">{fehler}</p>}

      {offen && (
        <ul className="ml-3 space-y-0.5 border-l pl-2">
          {sitzung.fragen === undefined && (
            <li className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('common.loading')}
            </li>
          )}
          {sitzung.fragen && sitzung.fragen.length === 0 && (
            <li className="px-2 py-1 text-xs text-muted-foreground">{t('story.noQuestionsYet')}</li>
          )}
          {sitzung.fragen?.map((frage) => {
            const gewaehlt = istGewaehlt(auswahl, frage)
            return (
              <li key={frage.queryId ?? frage.frageId}>
                <button
                  type="button"
                  onClick={() => onFrageWaehlen(sitzung.chatId, frage)}
                  aria-current={gewaehlt ? 'true' : undefined}
                  title={frage.text}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm hover:bg-muted',
                    gewaehlt ? 'bg-primary/10 font-medium text-primary' : 'text-foreground/80',
                  )}
                >
                  {frage.offen && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
                  <span className="truncate">{frage.offen ? t('story.running') : kurztitelFuer(frage)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
