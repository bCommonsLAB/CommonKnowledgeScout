'use client'

/**
 * Eine Belegkarte (D3): Nummer(n), Titel, Status-Plakette, Kennzeile, Kurztext
 * und „Original ansehen". Plakette und Kennzeile kommen aus der Konfig des
 * Detailansichtstyps; fehlt sie, faellt der Block weg.
 */

import { ExternalLink } from 'lucide-react'
import { Badge, Button } from '@ks/ui'
import { cn } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import type { BelegPlakette } from '@ks/contracts'
import { belegKonfig, kennzeileFuer, plaketteFuer, type Beleg } from './helpers'

/** Farben der vier Plaketten — generisch, nicht library-spezifisch. */
const PLAKETTE_KLASSE: Record<BelegPlakette, string> = {
  umsetzung: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  geplant: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  pruefung: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  abgelehnt: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
}

export interface BelegKarteProps {
  beleg: Beleg
  onOriginal: (beleg: Beleg) => void
}

export function BelegKarte({ beleg, onOriginal }: BelegKarteProps) {
  const { t } = useTranslation()
  const konfig = belegKonfig(beleg.typ)
  const plakette = plaketteFuer(konfig, beleg.doc)
  const kennzeile = kennzeileFuer(konfig, beleg.doc)

  return (
    <li className="rounded-lg border bg-card p-3 space-y-2" data-beleg={beleg.fileId}>
      <div className="flex items-start gap-2">
        <span className="flex shrink-0 gap-0.5 pt-0.5" aria-label={t('story.beleg.citedAs', { numbers: beleg.nummern.join(', ') })}>
          {beleg.nummern.map((n) => (
            <span
              key={n}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground"
            >
              {n}
            </span>
          ))}
        </span>
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
      {beleg.kurztext && <p className="line-clamp-3 text-xs text-muted-foreground">{beleg.kurztext}</p>}
      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onOriginal(beleg)}>
        <ExternalLink className="h-3 w-3" />
        {t('story.beleg.original')}
      </Button>
    </li>
  )
}
