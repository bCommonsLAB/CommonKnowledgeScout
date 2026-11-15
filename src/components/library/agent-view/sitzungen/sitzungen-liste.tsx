'use client'

/**
 * @fileoverview Linke Seite des Reiters „Sitzungen" (Register, Welle R3).
 *
 * @description
 * Figma „Liste": Sicht-Umschalter, Gruppieren/Sortierung, Suche, Chips,
 * gruppierte Zeilen (scrollen in IHREM Bereich) und die Legende B/N/R.
 * Reine Anordnung — Filter und Gruppen rechnet das Panel ueber die
 * `reiter-*`-Funktionen.
 *
 * @module components/library/agent-view/sitzungen
 */

import type { ReiterGruppe, ReiterGruppierung } from '@/lib/agent-view/sitzungen-register/reiter-gruppen'
import type { ReiterSicht, ReiterSortierung, ReiterWerkzeug } from '@/lib/agent-view/sitzungen-register/reiter-sicht'
import { SitzungenFilter } from './sitzungen-filter'
import { SitzungenGruppen } from './sitzungen-gruppen'
import { SitzungenUmschalter } from './sitzungen-umschalter'
import { StandZeichen } from './sitzung-zeile'

export interface SitzungenListeProps {
  sicht: ReiterSicht
  zahlen: Record<ReiterSicht, number>
  onSicht: (s: ReiterSicht) => void
  gruppierung: ReiterGruppierung
  onGruppierung: (g: ReiterGruppierung) => void
  sortierung: ReiterSortierung
  onSortierung: (s: ReiterSortierung) => void
  suche: string
  onSuche: (s: string) => void
  werkzeuge: readonly ReiterWerkzeug[]
  onWerkzeuge: (w: ReiterWerkzeug[]) => void
  von: string | null
  bis: string | null
  onZeitraum: (von: string | null, bis: string | null) => void
  gruppen: ReiterGruppe[]
  auswahl: string | null
  jahr: number
  onWaehlen: (registerId: string) => void
}

function Legende() {
  return (
    <div className="flex shrink-0 items-center gap-1.5 px-1.5 pt-2 text-[11px] text-muted-foreground">
      <StandZeichen zeichen="B" da titel="Beleg" /> Beleg
      <StandZeichen zeichen="N" da titel="Notiz" /> Notiz
      <StandZeichen zeichen="R" da={false} titel="im Bericht" /> im Bericht
    </div>
  )
}

export function SitzungenListe(p: SitzungenListeProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 p-3">
      <SitzungenUmschalter
        sicht={p.sicht} zahlen={p.zahlen} onSicht={p.onSicht}
        gruppierung={p.gruppierung} onGruppierung={p.onGruppierung}
        sortierung={p.sortierung} onSortierung={p.onSortierung}
      />
      <SitzungenFilter
        suche={p.suche} onSuche={p.onSuche} werkzeuge={p.werkzeuge} onWerkzeuge={p.onWerkzeuge}
        von={p.von} bis={p.bis} onZeitraum={p.onZeitraum}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <SitzungenGruppen gruppen={p.gruppen} auswahl={p.auswahl} jahr={p.jahr} onWaehlen={p.onWaehlen} />
      </div>
      <Legende />
    </div>
  )
}
