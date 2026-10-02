'use client'

/**
 * Einmaliger Hinweis zur Bedienung des Story-Modus (D10, Figma „6 · Kopf der
 * Seite"): steht beim ersten Besuch oben in der Mitte, „Verstanden" klickt
 * ihn weg. Ob er gezeigt wird und wo das gemerkt wird, entscheidet der
 * Gastgeber (App: Browser-Speicher wie die Perspektive, „?" im Kopf holt ihn
 * zurueck). Titel und Text kommen herein — Uebersetzung oder Konfig der
 * Library —, das Paket kennt keine Library.
 */

import { Info, X } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'

export interface StoryHinweisProps {
  titel: string
  text: string
  onVerstanden: () => void
}

export function StoryHinweis({ titel, text, onVerstanden }: StoryHinweisProps) {
  const { t } = useTranslation()
  return (
    <aside role="note" className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm" data-story-hinweis>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
        <Info className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium leading-snug">{titel}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
        <p className="text-xs text-muted-foreground">{t('story.hinweis.einmalig')}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onVerstanden} className="shrink-0 gap-1 self-center">
        <span>{t('story.hinweis.verstanden')}</span>
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </aside>
  )
}
