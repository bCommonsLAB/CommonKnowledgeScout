'use client'

/**
 * Die Beispielfragen unter der Fragebox (R1, 24.11.2026): Vor der ersten Frage
 * stehen sie offen da. Gibt es eine Antwort, klappen sie zu einer Zeile ein —
 * die Antwort beginnt dann direkt unter der Box; ein Klick holt sie zurueck.
 * Mit jeder neuen Antwort klappen sie wieder ein.
 */

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import { cn } from '@ks/util'

export interface StoryBeispieleProps {
  /** Es gibt eine Antwort (oder eine laeuft): eingeklappt statt offen. */
  eingeklappt: boolean
  /** Wechselt mit jeder gestellten Frage — danach wieder eingeklappt. */
  frage?: string
  /** Die Kacheln und die populaeren Fragen. */
  children: React.ReactNode
}

export function StoryBeispiele({ eingeklappt, frage, children }: StoryBeispieleProps): React.ReactElement {
  const { t } = useTranslation()
  const [offen, setOffen] = React.useState(false)
  React.useEffect(() => { setOffen(false) }, [frage])
  if (!eingeklappt) return <>{children}</>
  return (
    <div className="mt-3" data-story-beispiele={offen ? 'offen' : 'zu'}>
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => setOffen((o) => !o)}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[color:var(--site-accent-ink)] hover:underline sm:min-h-0"
      >
        {t('website.story.beispielfragen')}
        <ChevronDown className={cn('h-4 w-4 transition-transform', offen && 'rotate-180')} aria-hidden="true" />
      </button>
      {offen && children}
    </div>
  )
}
