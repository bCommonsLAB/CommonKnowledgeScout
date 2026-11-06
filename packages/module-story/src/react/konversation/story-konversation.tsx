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
import { RotateCcw, Sparkles, Trash2, User } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { ChatProcessingStep } from '@ks/contracts'
import { VerarbeitungEinfach } from '../verarbeitung-einfach'
import { AntwortText } from './antwort-text'
import type { FrageAntwort, Nachricht } from './types'

/** N5: was der Gastgeber in der Kopfzeile der Antwort rechts platziert (z. B. „Quellen anzeigen", Marken-Umschalter). */
export interface AntwortKopfApi {
  /** Sind die Zitatmarken dieser Antwort eingeblendet? */
  sichtbar: boolean
  /** Marken ein- oder ausblenden (unabhaengig vom Belege-Blatt). */
  setSichtbar: (sichtbar: boolean) => void
}

export interface StoryKonversationProps {
  paare: FrageAntwort[]
  laeuft: boolean
  schritte: ChatProcessingStep[]
  fehler: string | null
  /** Technische Meldung zum Fehler (D10d), klein darunter. */
  fehlerDetail?: string | null
  /** Anschlussfrage gewaehlt — die Eingabe uebernimmt sie. */
  onFrage: (text: string) => void
  /** Unter jeder Antwort, z. B. KI-Hinweis. */
  fuss?: (antwort: Nachricht) => ReactNode
  /** D6c: Frage loeschen (nach Rueckfrage); ohne Rueckruf kein Knopf. */
  onLoeschen?: (queryId: string) => Promise<void>
  /** D6c: Frage neu stellen — der Text wandert in die Eingabe. */
  onErneut?: (text: string) => void
  /**
   * N5: Zitatmarken erst zeigen, wenn der Leser „Quellen anzeigen" waehlt.
   * Ohne (Vorgabe false, z. B. Story-Modus mit stehender Beleg-Leiste) sind die
   * Marken immer sichtbar.
   */
  markenAnfangsVerborgen?: boolean
  /**
   * N5: rechts in der Kopfzeile der Antwort — der Gastgeber setzt hier seinen
   * „Quellen anzeigen"-Knopf; `enthuellen` blendet zugleich die Marken ein.
   */
  kopfAktion?: (antwort: Nachricht, api: AntwortKopfApi) => ReactNode
  /**
   * N5: Avatar der Antwort — der Gastgeber reicht sein Logo herein (die App das
   * KnowledgeScout-Logo). Ohne: ein neutraler Funke. Das Paket kennt kein Logo.
   */
  antwortAvatar?: ReactNode
}

/** Zahl der verschiedenen zitierten Dokumente einer Antwort. */
function quellenZahl(antwort: Nachricht): number {
  return new Set((antwort.belege ?? []).map((b) => b.fileId).filter(Boolean)).size
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

export function StoryKonversation({ paare, laeuft, schritte, fehler, fehlerDetail, onFrage, fuss, onLoeschen, onErneut, markenAnfangsVerborgen = false, kopfAktion, antwortAvatar }: StoryKonversationProps) {
  const { t } = useTranslation()
  // Avatar der Antwort: das Logo des Gastgebers, sonst ein neutraler Funke.
  const avatar = antwortAvatar ?? (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Sparkles className="h-4 w-4" />
    </div>
  )
  // N5: welche Antworten haben ihre Zitatmarken eingeblendet (umschaltbar: der
  // Leser zeigt und verbirgt sie, unabhaengig vom Belege-Blatt).
  const [sichtbarIds, setSichtbarIds] = useState<ReadonlySet<string>>(() => new Set())

  return (
    <div className="space-y-6" data-story-konversation>
      {paare.map((paar) => {
        const antwort = paar.antwort
        const antwortId = antwort ? (antwort.queryId ?? antwort.id) : ''
        const sichtbar = sichtbarIds.has(antwortId)
        const setSichtbar = (zeigen: boolean) =>
          setSichtbarIds((s) => {
            if (zeigen === s.has(antwortId)) return s
            const n = new Set(s)
            if (zeigen) n.add(antwortId)
            else n.delete(antwortId)
            return n
          })
        const quellen = antwort ? quellenZahl(antwort) : 0
        return (
          <article key={paar.kennung} data-konversation-id={paar.kennung} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div
                className="min-w-0 flex-1 rounded-xl border p-4"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--story-accent, hsl(var(--muted-foreground))) 7%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--story-accent, hsl(var(--muted-foreground))) 18%, transparent)',
                }}
              >
                <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--story-accent, hsl(var(--muted-foreground)))' }}>
                  {t('story.konversation.deineFrage')}
                </p>
                <p className="whitespace-pre-wrap break-words text-base font-semibold">{paar.frage.text}</p>
              </div>
              <FrageAktionen paar={paar} onLoeschen={onLoeschen} onErneut={onErneut} />
            </div>
            {antwort ? (
              <div className="flex gap-3" data-antwort={antwortId}>
                <div className="shrink-0" aria-hidden="true">{avatar}</div>
                <div className="min-w-0 flex-1 rounded-xl border bg-background p-4 sm:p-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{t('story.konversation.antwort')}</span>
                      {quellen > 0 && (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--story-accent, hsl(var(--primary))) 10%, transparent)',
                            color: 'var(--story-accent, hsl(var(--primary)))',
                          }}
                        >
                          {quellen === 1 ? t('story.konversation.quellenZitiert.one') : t('story.konversation.quellenZitiert.many', { count: quellen })}
                        </span>
                      )}
                    </div>
                    {kopfAktion?.(antwort, { sichtbar, setSichtbar })}
                  </div>
                  <AntwortText
                    text={antwort.text}
                    belege={antwort.belege}
                    markenVerborgen={markenAnfangsVerborgen && !sichtbar}
                    className="prose prose-sm max-w-none dark:prose-invert"
                  />
                  {fuss?.(antwort)}
                  {antwort.anschlussfragen && antwort.anschlussfragen.length > 0 && (
                    <div className="mt-4" data-anschlussfragen>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('story.konversation.weiterfragen')}</p>
                      <div className="flex flex-wrap gap-2">
                        {antwort.anschlussfragen.map((frage) => (
                          <button
                            key={frage}
                            type="button"
                            onClick={() => onFrage(frage)}
                            className="rounded-full border bg-background px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:border-primary hover:bg-muted"
                          >
                            {frage}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : laeuft ? (
              <div className="flex gap-3" data-antwort-laeuft>
                <div className="shrink-0" aria-hidden="true">{avatar}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-muted-foreground">{t('chatMessages.processing')}</div>
                  {schritte.length > 0 && (
                    <div className="mt-3 border-t border-border/50 pt-3">
                      <VerarbeitungEinfach schritte={schritte} />
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </article>
        )
      })}
      {fehler && (
        <div role="alert" className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{fehler}</p>
          {fehlerDetail && (
            <p className="mt-1 break-words text-xs text-destructive/70">
              {t('story.fehler.detail')}: {fehlerDetail}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
