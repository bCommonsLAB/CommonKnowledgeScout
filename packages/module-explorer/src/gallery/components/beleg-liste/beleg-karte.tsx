'use client'

/**
 * Eine Belegkarte (D3, D12k): Marke, Titel, Kennzeile, Status-Plakette und
 * „Original ansehen" — eine kompakte Zeile je Dokument. Plakette und
 * Kennzeile kommen aus der Konfig des Detailansichtstyps; fehlt sie, faellt
 * der Block weg. Der Knopf heisst „Detailansicht oeffnen" (Owner 04.10.):
 * Ein „Original" gibt es nur als Link in der Detailansicht selbst, hier sind
 * interpretierte Daten.
 *
 * D12k: Die Marke ist die Dokumentnummer (dieselbe wie im Antworttext), die
 * Karte traegt den Anker `beleg-<nummer>`. Ohne Nummer (D12q, Bestand ohne
 * Antwort) gibt es weder Marke noch Anker. Textstellen mit Seite (D7) und
 * der Kurztext sind Expertenwissen und liegen hinter einem Aufklapper
 * („stützt sich auf n Textstellen" bzw. „Mehr dazu"), zu beim Start.
 */

import { useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { Badge, Zitatmarke } from '@ks/ui'
import { cn } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import type { BelegPlakette } from '@ks/contracts'
import { belegKonfig, kennzeileFuer, plaketteFuer, type Beleg } from './helpers'
import { BelegTextstellen } from './beleg-textstellen'

/** Farben der vier Plaketten — generisch, nicht library-spezifisch. */
const PLAKETTE_KLASSE: Record<BelegPlakette, string> = {
  umsetzung: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  geplant: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  pruefung: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  abgelehnt: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
}

export interface BelegKarteProps {
  beleg: Beleg
  /** Original oeffnen; `page` nur, wenn eine Textstelle angeklickt wurde. */
  onOriginal: (beleg: Beleg, page?: number) => void
}

export function BelegKarte({ beleg, onOriginal }: BelegKarteProps) {
  const { t } = useTranslation()
  const [offen, setOffen] = useState(false)
  const konfig = belegKonfig(beleg.typ)
  const plakette = plaketteFuer(konfig, beleg.doc)
  const kennzeile = kennzeileFuer(konfig, beleg.doc)
  const anzahl = beleg.passages.length
  const hatDetails = anzahl > 0 || Boolean(beleg.kurztext)
  const detailsText =
    anzahl === 0 ? t('story.beleg.more') : anzahl === 1 ? t('story.beleg.passages.one') : t('story.beleg.passages.many', { count: anzahl })

  return (
    <li className="rounded-lg border bg-card p-2.5" data-beleg={beleg.fileId} id={beleg.nummer === undefined ? undefined : `beleg-${beleg.nummer}`}>
      <div className="flex items-start gap-2.5">
        {beleg.nummer !== undefined && (
          <Zitatmarke nummer={beleg.nummer} className="mt-0.5" aria-label={t('story.beleg.citedAs', { numbers: beleg.nummer })} />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug">{beleg.titel}</h3>
          {kennzeile.length > 0 && <p className="truncate text-xs text-muted-foreground">{kennzeile.join(' · ')}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => onOriginal(beleg)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {t('story.beleg.original')}
            </button>
            {hatDetails && (
              <button
                type="button"
                aria-expanded={offen}
                onClick={() => setOffen((o) => !o)}
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {detailsText}
                <ChevronDown className={cn('h-3 w-3 transition-transform', offen && 'rotate-180')} />
              </button>
            )}
          </div>
          {offen &&
            (anzahl > 0 ? (
              <div className="mt-1.5">
                <BelegTextstellen passages={beleg.passages} onSeite={(page) => onOriginal(beleg, page)} />
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">{beleg.kurztext}</p>
            ))}
        </div>
        {plakette && (
          <Badge
            variant="outline"
            className={cn('shrink-0 whitespace-nowrap', plakette.art === 'plakette' && PLAKETTE_KLASSE[plakette.plakette])}
          >
            {plakette.art === 'plakette' ? t(`story.beleg.status.${plakette.plakette}`) : plakette.wert}
          </Badge>
        )}
      </div>
    </li>
  )
}
