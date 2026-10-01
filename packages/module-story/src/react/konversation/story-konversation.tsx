'use client'

/**
 * Die gewaehlte Konversation in der Mitte (D6b): Frage, Antwort mit
 * Zitatmarken, Anschlussfragen; solange die Antwort laeuft, die
 * Verarbeitungsschritte in einfachen Worten (D2). Fehler stehen sichtbar
 * darunter. Was das Paket nicht kennt (KI-Hinweis, Konfig-Anzeige), kommt
 * als `fuss`-Slot je Antwort.
 */

import type { ReactNode } from 'react'
import { useState } from 'react'
import { HelpCircle, RotateCcw, Trash2, User } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { ChatProcessingStep } from '@ks/contracts'
import { VerarbeitungEinfach } from '../verarbeitung-einfach'
import { AntwortText } from './antwort-text'
import type { FrageAntwort, Nachricht } from './types'

export interface StoryKonversationProps {
  paare: FrageAntwort[]
  laeuft: boolean
  schritte: ChatProcessingStep[]
  fehler: string | null
  /** Anschlussfrage gewaehlt — die Eingabe uebernimmt sie. */
  onFrage: (text: string) => void
  /** Unter jeder Antwort, z. B. KI-Hinweis. */
  fuss?: (antwort: Nachricht) => ReactNode
  /** D6c: Frage loeschen (nach Rueckfrage); ohne Rueckruf kein Knopf. */
  onLoeschen?: (queryId: string) => Promise<void>
  /** D6c: Frage neu stellen — der Text wandert in die Eingabe. */
  onErneut?: (text: string) => void
}

function FrageAktionen({ paar, onLoeschen, onErneut }: Pick<StoryKonversationProps, 'onLoeschen' | 'onErneut'> & { paar: FrageAntwort }) {
  const { t } = useTranslation()
  const [loescht, setLoescht] = useState(false)
  const queryId = paar.frage.queryId ?? paar.antwort?.queryId
  if (!onErneut && !(onLoeschen && queryId)) return null
  return (
    <div className="flex shrink-0 items-start gap-1">
      {onErneut && (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('story.konversation.again')} aria-label={t('story.konversation.again')} onClick={() => onErneut(paar.frage.text)}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
      {onLoeschen && queryId && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
          title={t('story.konversation.delete')}
          aria-label={t('story.konversation.delete')}
          disabled={loescht}
          onClick={async () => {
            if (!confirm(t('story.konversation.deleteConfirm'))) return
            setLoescht(true)
            try {
              await onLoeschen(queryId)
            } finally {
              setLoescht(false)
            }
          }}
        >
          <Trash2 className={loescht ? 'h-3.5 w-3.5 animate-pulse' : 'h-3.5 w-3.5'} />
        </Button>
      )}
    </div>
  )
}

export function StoryKonversation({ paare, laeuft, schritte, fehler, onFrage, fuss, onLoeschen, onErneut }: StoryKonversationProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6" data-story-konversation>
      {paare.map((paar) => (
        <article key={paar.kennung} data-konversation-id={paar.kennung} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 rounded-lg border bg-background p-3">
              <p className="whitespace-pre-wrap break-words text-sm font-medium">{paar.frage.text}</p>
            </div>
            <FrageAktionen paar={paar} onLoeschen={onLoeschen} onErneut={onErneut} />
          </div>
          {paar.antwort ? (
            <div className="rounded-lg border bg-muted/30 p-4" data-antwort={paar.antwort.queryId ?? paar.antwort.id}>
              <AntwortText text={paar.antwort.text} belege={paar.antwort.belege} className="prose prose-sm max-w-none dark:prose-invert" />
              {fuss?.(paar.antwort)}
              {paar.antwort.anschlussfragen && paar.antwort.anschlussfragen.length > 0 && (
                <div className="mt-4 rounded border bg-background/60 p-3">
                  <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <HelpCircle className="h-3 w-3" />
                    {t('suggestedQuestions.label')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {paar.antwort.anschlussfragen.map((frage) => (
                      <Button key={frage} variant="outline" size="sm" className="h-auto whitespace-normal px-3 py-1.5 text-left text-xs" onClick={() => onFrage(frage)}>
                        {frage}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : laeuft ? (
            <div className="rounded-lg border bg-muted/30 p-4" data-antwort-laeuft>
              <div className="text-sm text-muted-foreground">{t('chatMessages.processing')}</div>
              {schritte.length > 0 && (
                <div className="mt-3 border-t border-border/50 pt-3">
                  <VerarbeitungEinfach schritte={schritte} />
                </div>
              )}
            </div>
          ) : null}
        </article>
      ))}
      {fehler && (
        <div role="alert" className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {fehler}
        </div>
      )}
    </div>
  )
}
