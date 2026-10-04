'use client'

/**
 * Die Fragen-Chronik mobil (D4, Plan `story-dreiteilung-fragenchronik`): ein
 * Sheet von links hinter dem Menue-Knopf im Story-Kopf. Der Inhalt ist der
 * `storyChronik`-Slot der App; er wird NUR hier gemountet, solange das Sheet
 * offen ist — auf dem Desktop nur in der Spalte, nie beides (Lehre aus M4h;
 * Radix haelt geschlossenen Dialog-Inhalt nicht im DOM).
 */

import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'

export interface StoryChronikSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function StoryChronikSheet({ open, onOpenChange, children }: StoryChronikSheetProps) {
  const { t } = useTranslation()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-full flex-col p-0 pt-10 sm:max-w-sm" data-story-chronik-sheet>
        <SheetTitle className="sr-only">{t('story.chronik.title')}</SheetTitle>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
