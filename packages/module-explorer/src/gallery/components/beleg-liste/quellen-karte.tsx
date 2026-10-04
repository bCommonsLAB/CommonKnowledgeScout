'use client'

/**
 * Eine Karte der Quellenliste (D12q, Owner 04.10.): Titel und Kennzeile aus
 * der Konfig des Inhaltstyps, rechts der Knopf „Detailansicht oeffnen" — eine
 * Zeile hoch. Keine Status-Plakette (die ist eine Sache der Belege unter
 * einer Antwort und ihres Typs), keine Textstellen, kein Kurztext: Der
 * Bestand ist generisch — Buch, Veranstaltung, Massnahme sehen hier gleich
 * aus, nur die Kennzeile unterscheidet sich (Autor und Jahr, Nummer und
 * Arbeitsgruppe, nichts).
 */

import { ExternalLink } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { belegKonfig, kennzeileFuer, type Beleg } from './helpers'

export interface QuellenKarteProps {
  beleg: Beleg
  onOeffnen: (beleg: Beleg) => void
}

export function QuellenKarte({ beleg, onOeffnen }: QuellenKarteProps) {
  const { t } = useTranslation()
  const kennzeile = kennzeileFuer(belegKonfig(beleg.typ), beleg.doc)
  return (
    <li className="rounded-lg border bg-card px-2.5 py-2" data-beleg={beleg.fileId}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-snug">{beleg.titel}</h3>
          {kennzeile.length > 0 && <p className="truncate text-xs text-muted-foreground">{kennzeile.join(' · ')}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onOeffnen(beleg)}
          aria-label={t('story.beleg.original')}
          title={t('story.beleg.original')}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </li>
  )
}
