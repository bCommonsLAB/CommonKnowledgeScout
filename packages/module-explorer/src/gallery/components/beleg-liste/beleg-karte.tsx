'use client'

/**
 * Eine Belegkarte (D3): Nummer(n), Titel, Status-Plakette, Kennzeile, Kurztext
 * und „Original ansehen". Plakette und Kennzeile kommen aus der Konfig des
 * Detailansichtstyps; fehlt sie, faellt der Block weg.
 *
 * D7: Die Nummern erscheinen als Zitatmarken (①…), die Karte traegt den Anker
 * `beleg-<n>`, auf den die Marke im Antworttext zeigt. Darunter die zitierten
 * Textstellen mit Seite (nur bei Quellen mit Seitenankern) — die Seite oeffnet
 * das Original dort.
 */

import { ExternalLink } from 'lucide-react'
import { Badge, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@ks/ui'
import { cn, zitatmarke } from '@ks/util'
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
  const konfig = belegKonfig(beleg.typ)
  const plakette = plaketteFuer(konfig, beleg.doc)
  const kennzeile = kennzeileFuer(konfig, beleg.doc)
  const anzahl = beleg.passages.length
  const textstellenText = anzahl === 1 ? t('story.beleg.passages.one') : t('story.beleg.passages.many', { count: anzahl })

  const marken = (
    <span className="flex shrink-0 gap-0.5 pt-0.5" aria-label={t('story.beleg.citedAs', { numbers: beleg.nummern.join(', ') })}>
      {beleg.nummern.map((n) => (
        <span
          key={n}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground"
        >
          {zitatmarke(n)}
        </span>
      ))}
    </span>
  )

  return (
    <li className="rounded-lg border bg-card p-3 space-y-2" data-beleg={beleg.fileId} id={`beleg-${beleg.nummern[0]}`}>
      {/* D12e: Auch die weiteren Marken dieses Dokuments (alte Antworten je Textstelle) finden die Karte. */}
      {beleg.nummern.slice(1).map((n) => (
        <span key={n} id={`beleg-${n}`} className="sr-only" aria-hidden="true" />
      ))}
      <div className="flex items-start gap-2">
        {anzahl > 0 ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>{marken}</TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                {textstellenText}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          marken
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug">{beleg.titel}</h3>
          {kennzeile.length > 0 && <p className="truncate text-xs text-muted-foreground">{kennzeile.join(' · ')}</p>}
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
      {anzahl > 0 ? (
        <BelegTextstellen passages={beleg.passages} onSeite={(page) => onOriginal(beleg, page)} />
      ) : (
        beleg.kurztext && <p className="line-clamp-3 text-xs text-muted-foreground">{beleg.kurztext}</p>
      )}
      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onOriginal(beleg)}>
        <ExternalLink className="h-3 w-3" />
        {t('story.beleg.original')}
      </Button>
    </li>
  )
}
