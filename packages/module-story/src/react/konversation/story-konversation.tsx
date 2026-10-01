'use client'

/**
 * Die gewaehlte Konversation in der Mitte (D6b): Frage, Antwort mit
 * Zitatmarken, Anschlussfragen; solange die Antwort laeuft, die
 * Verarbeitungsschritte in einfachen Worten (D2). Fehler stehen sichtbar
 * darunter. Was das Paket nicht kennt (KI-Hinweis, Konfig-Anzeige), kommt
 * als `fuss`-Slot je Antwort.
 */

import type { ReactNode } from 'react'
import { HelpCircle, User } from 'lucide-react'
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
}

export function StoryKonversation({ paare, laeuft, schritte, fehler, onFrage, fuss }: StoryKonversationProps) {
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
