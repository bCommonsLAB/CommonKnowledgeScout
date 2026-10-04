'use client'

/**
 * Der Antworttext einer Konversation (D6b): Markdown mit derselben Engine wie
 * die Buch-Ansicht (`md` aus `@ks/viewers`), Zitatmarken als Anker auf die
 * Belegkarte (D7) mit Titel („Dokumenttitel: stützt sich auf n Textstellen").
 *
 * D12k: Die Marken tragen die Dokumentnummer, auch bei alten Antworten, die je
 * Textstelle nummerieren (`dokumentNummern`); mehrere Marken desselben
 * Dokuments hintereinander werden eine. Form und Groesse der Marke kommen aus
 * `@ks/ui` (`zitatmarkeKlasse`).
 *
 * Ein Klick auf eine Marke scrollt zur Karte `#beleg-k` im Dokument, statt die
 * Adresse zu aendern — im Embed gehoert die Adresszeile der fremden Seite.
 * Steht die Karte nicht im DOM (die Quellen-Schicht ist zu, D11b), bittet die
 * Mitte den Gastgeber per `STORY_BELEG_ZEIGEN_EVENT`, sie zu oeffnen und zur
 * Marke zu scrollen (D12e). Klicks mit Zusatztaste oder mittlerer Maustaste
 * bleiben dem Browser.
 */

import { useCallback, useMemo, type MouseEvent } from 'react'
import { md } from '@ks/viewers'
import { zitatmarkeKlasse } from '@ks/ui'
import { dokumentNummern, zitatmarkenImText } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import { STORY_BELEG_ZEIGEN_EVENT, type DocReference, type StoryBelegZeigenDetail } from '@ks/contracts'
import { belegeNachDokument, belegTitel, mitMarkenTiteln } from './zitat-titel'

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
    const nummern = dokumentNummern(belege)
    const nachDokument = belegeNachDokument(belege)
    const roh = md.render(zitatmarkenImText(text, (n) => nummern.get(n)))
    return mitMarkenTiteln(
      roh,
      (k) => {
        const gruppe = nachDokument.get(k)
        if (!gruppe) return undefined
        const n = gruppe.reduce((summe, b) => summe + (b.passages?.length ?? 0), 0)
        const dokument = belegTitel(gruppe[0])
        if (n === 0) return dokument
        const stellen = n === 1 ? t('story.beleg.passages.one') : t('story.beleg.passages.many', { count: n })
        return t('story.zitat.marke', { document: dokument, passages: stellen })
      },
      zitatmarkeKlasse('text'),
    )
  }, [text, belege, t])

  const onClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const link = e.target instanceof Element ? e.target.closest('a[data-beleg]') : null
    if (!link) return
    e.preventDefault()
    const marke = link.getAttribute('data-beleg') ?? ''
    const karte = belegKarte(marke)
    if (!karte) {
      // Die Quellen sind zu — der Gastgeber oeffnet sie und scrollt (useBelegSprung in der Galerie).
      window.dispatchEvent(new CustomEvent<StoryBelegZeigenDetail>(STORY_BELEG_ZEIGEN_EVENT, { detail: { marke } }))
      return
    }
    karte.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // Der Text kommt vom Sprachmodell der Instanz — wie in der App mit `html: true` gerendert.
  return <div className={className} data-antwort-text onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
