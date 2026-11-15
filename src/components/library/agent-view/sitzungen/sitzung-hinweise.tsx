'use client'

/**
 * @fileoverview Kasten „warum" und Hinweise einer Sitzung (Register, Welle R3).
 *
 * @description
 * Figma „Warum noch nicht berichtet" und „Hinweis": Der Kasten erklaert den
 * gerechneten Stand aus den Stempeln (`warum`), je Auffaelligkeit folgt ein
 * eigener Kasten mit dem Text des Servers. „Beleg ohne Vorhaben" bietet
 * gleich die zwei Antworten an: Vorhaben vorschlagen oder so lassen (mit
 * Grund). Ist die Sitzung berichtet, genuegt eine Zeile mit den Stempeln.
 *
 * @module components/library/agent-view/sitzungen
 */

import type { ReactNode } from 'react'
import { AlertTriangle, Folder, Info } from 'lucide-react'
import { Button } from '@ks/ui'
import { cn } from '@/lib/utils'
import { AUFFAELLIG_NAMEN, GEMELDET_FRIST_TAGE, auffaelligGruende } from '@/lib/agent-view/sitzungen-register/reiter-sicht'
import { warum, type Warum } from '@/lib/agent-view/sitzungen-register/reiter-texte'
import type { SitzungsSicht } from '@/lib/agent-view/sitzungen-register/types'

const TON_KLASSE: Readonly<Record<Warum['ton'], { kasten: string; titel: string }>> = {
  offen: { kasten: 'border-orange-300 bg-orange-50 dark:border-orange-500/50 dark:bg-orange-500/10', titel: 'text-orange-700 dark:text-orange-400' },
  gut: { kasten: 'border-green-300 bg-green-50 dark:border-green-500/40 dark:bg-green-500/10', titel: 'text-green-700 dark:text-green-400' },
  neutral: { kasten: 'bg-muted/50', titel: 'text-foreground' },
}

function Kasten({ ton, symbol, titel, children }: { ton: Warum['ton']; symbol: 'info' | 'alarm'; titel: string; children: ReactNode }) {
  const Symbol = symbol === 'info' ? Info : AlertTriangle
  return (
    <div className={cn('flex w-full items-start gap-2.5 rounded-[10px] border px-3.5 py-3', TON_KLASSE[ton].kasten)}>
      <Symbol className={cn('mt-px h-4 w-4 shrink-0', TON_KLASSE[ton].titel)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px]">
        <p className={cn('font-semibold', TON_KLASSE[ton].titel)}>{titel}</p>
        {children}
      </div>
    </div>
  )
}

export function SitzungHinweise({
  zeile,
  jetzt,
  onVorschlagen,
  onSoLassen,
}: {
  zeile: SitzungsSicht
  jetzt: Date
  onVorschlagen: () => void
  onSoLassen: () => void
}) {
  const w = warum(zeile)
  const gruende = auffaelligGruende(zeile, jetzt)
  return (
    <>
      {zeile.stand === 'berichtet' ? (
        <p className="text-xs text-muted-foreground">{w.text}</p>
      ) : (
        <Kasten ton={w.ton} symbol="info" titel={w.titel}>
          <p className="text-foreground/80">{w.text}</p>
        </Kasten>
      )}
      {gruende.map((grund) => {
        const texte = grund === 'gemeldet_ohne_beleg'
          ? [`Seit über ${GEMELDET_FRIST_TAGE} Tagen gemeldet, ein Beleg ist nicht eingetroffen.`]
          : zeile.hinweise.filter((h) => h.code === grund).map((h) => h.text)
        return (
          <Kasten key={grund} ton="offen" symbol="alarm" titel={AUFFAELLIG_NAMEN[grund]}>
            {texte.map((t) => <p key={t} className="text-foreground/80">{t}</p>)}
            {grund === 'beleg_ohne_vorhaben' && (
              <div className="mt-1.5 flex flex-nowrap items-center gap-2">
                <Button size="sm" onClick={onVorschlagen}>
                  <Folder className="mr-2 h-[15px] w-[15px]" aria-hidden /> Vorhaben vorschlagen
                </Button>
                <Button size="sm" variant="outline" onClick={onSoLassen}>So lassen, mit Grund …</Button>
              </div>
            )}
          </Kasten>
        )
      })}
    </>
  )
}
