'use client'

/**
 * Der Antworttext einer Konversation (D6b): Markdown mit derselben Engine wie
 * die Buch-Ansicht (`md` aus `@ks/viewers`), Zitatmarken ①… als Anker auf die
 * Belegkarte (D7) mit Titel („Dokument: stützt sich auf n Textstellen").
 *
 * Ein Klick auf eine Marke scrollt zur Karte `#beleg-n` im Dokument, statt die
 * Adresse zu aendern — im Embed gehoert die Adresszeile der fremden Seite.
 * Klicks mit Zusatztaste oder mittlerer Maustaste bleiben dem Browser.
 */

import { useCallback, useMemo, type MouseEvent } from 'react'
import { md } from '@ks/viewers'
import { zitatmarkenImText } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import type { DocReference } from '@ks/contracts'
import { mitMarkenTiteln } from './zitat-titel'

export interface AntwortTextProps {
  text: string
  belege?: DocReference[]
  className?: string
}

/** Die Belegkarte zur Marke — `document.getElementById`, weil Mitte und Karten in getrennten Slots haengen. */
function belegKarte(nummer: string): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.getElementById(`beleg-${nummer}`)
}

export function AntwortText({ text, belege = [], className }: AntwortTextProps) {
  const { t } = useTranslation()
  const html = useMemo(() => {
    const roh = md.render(zitatmarkenImText(text))
    return mitMarkenTiteln(roh, belege, (b) => {
      const n = b.passages?.length ?? 0
      const stellen = n === 1 ? t('story.beleg.passages.one') : t('story.beleg.passages.many', { count: n })
      const dokument = b.fileName ?? b.description
      return n > 0 ? t('story.zitat.marke', { document: dokument, passages: stellen }) : dokument
    })
  }, [text, belege, t])

  const onClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = e.target instanceof Element ? e.target.closest('a[data-beleg]') : null
    if (!link) return
    e.preventDefault()
    const karte = belegKarte(link.getAttribute('data-beleg') ?? '')
    if (!karte) {
      console.warn('[AntwortText] Keine Belegkarte zur Marke gefunden', { marke: link.getAttribute('data-beleg') })
      return
    }
    karte.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // Der Text kommt vom Sprachmodell der Instanz — wie in der App mit `html: true` gerendert.
  return <div className={className} data-antwort-text onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
